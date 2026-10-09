import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { ExtensionInfo } from "@/models/extension";
import { InvokeResponse } from "@/models/response";
import {
  GTaskEventPayload,
  GTaskEventStatusEnums,
  PTaskEventPayload,
  PTaskEventStatusEnums,
  TaskTypeEnums,
} from "@/models/task";
import {
  TASK_GROUP_UPDATE_EVENT,
  TASK_PROGRESS_UPDATE_EVENT,
  TaskService,
} from "@/services/task";
import { responseHandler } from "@/utils/response";
import { sanitizeFileName } from "@/utils/string";

export const EXTENSION_REFRESH_EVENT = "extension:refresh-list";

// Reasons an extension cannot be updated. "noSource" (no repoUrl configured)
// is reported separately on the host as "skipped", not as a hard failure.
export type ExtensionUpdateCheckFailureReason =
  | "sourceInvalid"
  | "sourceUnavailable"
  | "notFound"
  | "invalidVersion";

export interface ExtensionUpdateCandidate {
  identifier: string;
  name: string;
  currentVersion?: string | null;
  latestVersion: string;
  downloadUrl: string;
}

export interface ExtensionUpdateCheckFailure {
  identifier: string;
  reason: ExtensionUpdateCheckFailureReason;
  details?: string;
}

export interface ExtensionUpdateCheckResult {
  candidates: ExtensionUpdateCandidate[];
  upToDateIdentifiers: string[];
  skippedIdentifiers: string[];
  failures: ExtensionUpdateCheckFailure[];
}

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const getErrorDetails = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Strip an optional leading "v"/"V" and validate the result is a semver string.
const normalizeSemver = (version: string): string | undefined => {
  const normalized = version.trim().replace(/^[vV](?=\d)/, "");
  return SEMVER_PATTERN.test(normalized) ? normalized : undefined;
};

const compareSemver = (a: string, b: string): number => {
  const [aMain, aPre = ""] = a.split("-");
  const [bMain, bPre = ""] = b.split("-");
  const aParts = aMain.split(".").map(Number);
  const bParts = bMain.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
  }
  if (!aPre && !bPre) return 0;
  if (!aPre) return 1;
  if (!bPre) return -1;
  return aPre < bPre ? -1 : aPre > bPre ? 1 : 0;
};

const isVersionNewer = (next: string, current?: string | null): boolean => {
  const a = normalizeSemver(next);
  const b = current ? normalizeSemver(current) : undefined;
  if (!a) return false;
  if (!b) return true;
  return compareSemver(a, b) > 0;
};

// Parse a GitHub repository URL ("https://github.com/{owner}/{repo}") into owner/repo.
// Accepts trailing ".git", slashes and extra path segments; rejects non-github hosts.
const parseGithubRepoPath = (
  repoUrl: string
): { owner: string; repo: string } | undefined => {
  let url: URL;
  try {
    url = new URL(repoUrl.trim());
  } catch {
    return undefined;
  }
  if (url.hostname.toLowerCase() !== "github.com") return undefined;
  const [owner, repo] = url.pathname.split("/").filter(Boolean).slice(0, 2);
  if (!owner || !repo) return undefined;
  return { owner, repo: repo.replace(/\.git$/i, "") };
};

interface GithubApiReleaseAsset {
  name: string;
  browser_download_url: string;
}
interface GithubApiRelease {
  tag_name: string;
  assets?: GithubApiReleaseAsset[];
}

const GITHUB_API_CONCURRENCY = 4;

// Run an async mapper over `items` with a bounded number of in-flight requests.
const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
};

const fetchLatestGithubRelease = async (
  owner: string,
  repo: string
): Promise<{ release?: GithubApiRelease; errorDetails?: string }> => {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  try {
    const response = await tauriFetch(apiUrl, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (response.status === 404) return {}; // no releases published yet
    if (!response.ok) {
      return { errorDetails: `HTTP ${response.status}` };
    }
    return { release: (await response.json()) as GithubApiRelease };
  } catch (error) {
    return { errorDetails: getErrorDetails(error) };
  }
};

// Pick the release asset that ships the given extension. Prefers an exact
// "{identifier}.sjmclx" file, then falls back to "{identifier}-*" / "{identifier}_*".
const findExtensionAsset = (
  identifier: string,
  assets: GithubApiReleaseAsset[]
): GithubApiReleaseAsset | undefined => {
  const id = identifier.toLowerCase();
  const exact = assets.find((a) => a.name.toLowerCase() === `${id}.sjmclx`);
  if (exact) return exact;
  return assets.find((a) => {
    const name = a.name.toLowerCase();
    return (
      name.endsWith(".sjmclx") &&
      (name.startsWith(`${id}-`) || name.startsWith(`${id}_`))
    );
  });
};

/**
 * Service class for managing launcher extensions.
 */
export class ExtensionService {
  /**
   * RETRIEVE the list of installed extensions.
   * @returns {Promise<InvokeResponse<ExtensionInfo[]>>}
   */
  @responseHandler("extension")
  static async retrieveExtensionList(): Promise<
    InvokeResponse<ExtensionInfo[]>
  > {
    return await invoke("retrieve_extension_list");
  }

  /**
   * ADD an extension package by path.
   * @param {string} path The absolute path of the extension package (.sjmclx).
   * @param {string} [expectedIdentifier] The identifier expected from the package metadata. (for extension update scenario)
   * @param {string} [expectedCurrentVersion] The currently installed version expected before replacing the extension.
   * @param {boolean} [requireNewerVersion] Whether the package version must be newer than the expected current version.
   * @returns {Promise<InvokeResponse<ExtensionInfo>>}
   */
  @responseHandler("extension")
  static async addExtension(
    path: string,
    expectedIdentifier?: string,
    expectedCurrentVersion?: string,
    requireNewerVersion?: boolean
  ): Promise<InvokeResponse<ExtensionInfo>> {
    return await invoke("add_extension", {
      path,
      expectedIdentifier,
      expectedCurrentVersion,
      requireNewerVersion,
    });
  }

  /**
   * DELETE an installed extension by identifier.
   * @param {string} identifier The extension identifier.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("extension")
  static async deleteExtension(
    identifier: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("delete_extension", { identifier });
  }

  /**
   * CHECK installed extensions for updates, using each extension's `repoUrl`
   * (a GitHub repository URL declared in its manifest). Extensions without an
   * `repoUrl` are reported in `upToDateIdentifiers` (treated as "no update
   * source / skipped"). Reports progress via `onProgress(completed, total)`.
   */
  static async checkExtensionUpdates(
    extensions: ExtensionInfo[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<ExtensionUpdateCheckResult> {
    const result: ExtensionUpdateCheckResult = {
      candidates: [],
      upToDateIdentifiers: [],
      skippedIdentifiers: [],
      failures: [],
    };
    const total = extensions.length;
    let completed = 0;
    const reportProgress = () => onProgress?.(++completed, total);

    // Resolve the {owner, repo} for every extension with a usable repoUrl.
    // Extensions without one are reported as "skipped" (no update source).
    const checks = extensions.flatMap((extension) => {
      const repoPath = extension.repoUrl
        ? parseGithubRepoPath(extension.repoUrl)
        : undefined;
      if (!repoPath) {
        result.skippedIdentifiers.push(extension.identifier);
        reportProgress();
        return [];
      }
      return [{ extension, repoPath }];
    });

    // Fetch each repo's latest release concurrently (bounded to avoid rate limits).
    const releases = await mapWithConcurrency(
      checks,
      GITHUB_API_CONCURRENCY,
      async ({ extension, repoPath }) => {
        const { release, errorDetails } = await fetchLatestGithubRelease(
          repoPath.owner,
          repoPath.repo
        );
        return { extension, release, errorDetails };
      }
    );

    for (const { extension, release, errorDetails } of releases) {
      const asset =
        release?.assets &&
        findExtensionAsset(extension.identifier, release.assets);

      if (!release) {
        result.failures.push({
          identifier: extension.identifier,
          reason: "sourceUnavailable",
          details: errorDetails,
        });
      } else if (!asset) {
        result.failures.push({
          identifier: extension.identifier,
          reason: "notFound",
        });
      } else {
        const latestVersion = normalizeSemver(release.tag_name);
        if (!latestVersion) {
          result.failures.push({
            identifier: extension.identifier,
            reason: "invalidVersion",
          });
        } else if (isVersionNewer(latestVersion, extension.version)) {
          result.candidates.push({
            identifier: extension.identifier,
            name: extension.name,
            currentVersion: extension.version,
            latestVersion,
            downloadUrl: asset.browser_download_url,
          });
        } else {
          result.upToDateIdentifiers.push(extension.identifier);
        }
      }
      reportProgress();
    }

    return result;
  }

  /**
   * DOWNLOAD an extension update package into `cacheDir`. The `taskGroup` is
   * supplied by the caller (deterministic) so it can be reused to cancel the
   * download later. Resolves with `{path}` on completion, `{cancelled}` if the
   * task group was cancelled, or `{error}` on failure.
   */
  static async downloadExtensionUpdate(
    candidate: ExtensionUpdateCandidate,
    cacheDir: string,
    taskGroup: string,
    onProgress?: (percent: number) => void
  ): Promise<{ path?: string; error?: string; cancelled?: boolean }> {
    const normalizedCacheDir = cacheDir.trim();
    if (!normalizedCacheDir) {
      return { error: "Extension update cache directory is empty" };
    }

    const filename = sanitizeFileName(
      `${candidate.identifier}_${candidate.latestVersion}.sjmclx`
    );
    let destination: string;
    try {
      destination = await join(normalizedCacheDir, filename);
    } catch (error) {
      return { error: getErrorDetails(error) };
    }

    // Resolve once via `finishDownload` from any terminal task event; the
    // listeners are torn down here so they never leak past the download.
    let settled = false;
    let failureReason: string | undefined;
    let unlistenProgress = () => {};
    let unlistenGroup = () => {};
    let finishDownload!: (result: {
      path?: string;
      error?: string;
      cancelled?: boolean;
    }) => void;
    const downloadResult = new Promise<{
      path?: string;
      error?: string;
      cancelled?: boolean;
    }>((resolve) => {
      finishDownload = (result) => {
        if (settled) return;
        settled = true;
        unlistenProgress();
        unlistenGroup();
        resolve(result);
      };
    });

    const handleProgressUpdate = (payload: PTaskEventPayload) => {
      if (payload.taskGroup !== taskGroup) return;
      switch (payload.event.status) {
        case PTaskEventStatusEnums.Started:
          onProgress?.(0);
          break;
        case PTaskEventStatusEnums.InProgress:
          onProgress?.(
            Math.max(0, Math.min(100, Number(payload.event.percent) || 0))
          );
          break;
        case PTaskEventStatusEnums.Failed:
          failureReason = payload.event.reason;
          finishDownload({ error: payload.event.reason });
          break;
        case PTaskEventStatusEnums.Cancelled:
          finishDownload({ cancelled: true });
          break;
      }
    };

    const handleGroupUpdate = (payload: GTaskEventPayload) => {
      if (payload.taskGroup !== taskGroup) return;
      switch (payload.event) {
        case GTaskEventStatusEnums.Completed:
          onProgress?.(100);
          finishDownload({ path: destination });
          break;
        case GTaskEventStatusEnums.Failed:
          finishDownload({
            error: failureReason || "Extension update download failed",
          });
          break;
        case GTaskEventStatusEnums.Cancelled:
          finishDownload({ cancelled: true });
          break;
      }
    };

    try {
      const webview = getCurrentWebview();
      unlistenProgress = await webview.listen<PTaskEventPayload>(
        TASK_PROGRESS_UPDATE_EVENT,
        (event) => handleProgressUpdate(event.payload)
      );
      unlistenGroup = await webview.listen<GTaskEventPayload>(
        TASK_GROUP_UPDATE_EVENT,
        (event) => handleGroupUpdate(event.payload)
      );

      const response = await TaskService.scheduleProgressiveTaskGroup(
        taskGroup,
        [
          {
            taskType: TaskTypeEnums.Download,
            src: candidate.downloadUrl,
            dest: destination,
            filename,
          },
        ],
        false
      );

      if (response.status !== "success") {
        finishDownload({
          error: String(
            response.raw_error || response.details || response.message
          ),
        });
      } else if (!settled) {
        onProgress?.(0);
      }
    } catch (error) {
      finishDownload({ error: getErrorDetails(error) });
    }

    return await downloadResult;
  }

  /**
   * Listen for extension refresh events.
   * @param callback - The callback to be invoked when an extension refresh event occurs.
   */
  static onExtensionRefresh(callback: () => void): () => void {
    const unlisten = getCurrentWebview().listen<void>(
      EXTENSION_REFRESH_EVENT,
      () => {
        callback();
      }
    );

    return () => {
      unlisten.then((f) => f());
    };
  }
}

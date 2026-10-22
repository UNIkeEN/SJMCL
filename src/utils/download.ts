import type { TFunction } from "i18next";
import {
  type DownloadError,
  type DownloadGroup,
  DownloadGroupState,
  type DownloadGroupStats,
  type DownloadGroupSummary,
  type DownloadTask,
  DownloadTaskState,
} from "@/models/download";

const MAX_DOWNLOAD_ETA_SECS = 24 * 60 * 60;
const DOWNLOAD_ETA_SMOOTHING_SECS = 3;

export interface DownloadSnapshotUpdates {
  tasks: Map<string, Partial<DownloadTask>>;
  groups: Map<string, Partial<DownloadGroupSummary>>;
}

// Keep live events from being overwritten by an in-flight snapshot.
export const mergeDownloadSnapshot = (
  snapshot: DownloadGroup,
  updates: DownloadSnapshotUpdates
): DownloadGroup => ({
  ...snapshot,
  ...updates.groups.get(snapshot.id),
  tasks: snapshot.tasks.map((task) => ({
    ...task,
    ...updates.tasks.get(task.id),
  })),
});

export const getDownloadErrorText = (
  error: unknown,
  t: TFunction
): string | undefined => {
  if (!error) return undefined;
  if (typeof error === "object" && "code" in error) {
    const { code, params } = error as DownloadError;
    return t(`Services.task.common.description.${code}`, params);
  }
  return t("Services.task.common.description.OTHER_ERROR", {
    details: String(error),
  });
};

export const shouldShowDownloadProgress = (
  group: Pick<DownloadGroup, "state" | "finish" | "error">,
  task?: Pick<DownloadTask, "state">
): boolean =>
  !group.finish &&
  !group.error &&
  (group.state === DownloadGroupState.Active ||
    group.state === DownloadGroupState.Queued) &&
  (!task ||
    task.state === DownloadTaskState.Pending ||
    task.state === DownloadTaskState.Downloading ||
    task.state === DownloadTaskState.Verifying);

export const getDownloadStats = (tasks: DownloadTask[]): DownloadGroupStats => {
  const downloads = tasks.filter((task) => task.executor === "download");
  return {
    total: downloads.length,
    done: downloads.filter((task) => task.state === DownloadTaskState.Done)
      .length,
    failed: downloads.filter((task) => task.state === DownloadTaskState.Failed)
      .length,
    cancelled: downloads.filter(
      (task) => task.state === DownloadTaskState.Cancelled
    ).length,
    downloading: downloads.filter(
      (task) =>
        task.state === DownloadTaskState.Downloading ||
        task.state === DownloadTaskState.Verifying
    ).length,
    pending: downloads.filter(
      (task) =>
        task.state === DownloadTaskState.Pending ||
        task.state === DownloadTaskState.Paused
    ).length,
    verified: downloads.filter((task) => task.verified).length,
  };
};

export const getDownloadGroupProgress = (
  tasks: DownloadTask[]
): number | undefined => {
  const downloads = tasks.filter((task) => task.executor === "download");
  if (
    !downloads.some(
      (task) => task.state === DownloadTaskState.Done || task.total > 0
    )
  ) {
    return undefined;
  }
  // Include partial files so a single archive advances before it completes.
  const completed = downloads.reduce(
    (sum, task) =>
      sum +
      (task.state === DownloadTaskState.Done
        ? 1
        : task.total > 0
          ? Math.min(1, Math.max(0, task.received / task.total))
          : 0),
    0
  );
  return (completed * 100) / downloads.length;
};

export const estimateDownloadGroupEta = (
  state: DownloadGroupState,
  tasks: DownloadTask[],
  sample?: DownloadGroup["etaSample"],
  now = performance.now()
): Pick<DownloadGroup, "etaSecs" | "etaSample"> => {
  if (
    state !== DownloadGroupState.Active ||
    tasks.some(
      (task) => task.state === DownloadTaskState.Failed && task.retriesExhausted
    )
  ) {
    return { etaSecs: undefined, etaSample: undefined };
  }

  const downloads = tasks.filter((task) => task.executor === "download");
  const done = downloads.filter(
    (task) => task.state === DownloadTaskState.Done
  ).length;
  const received = downloads.reduce(
    (sum, task) =>
      sum +
      (task.state === DownloadTaskState.Done
        ? Math.max(task.received ?? 0, task.total ?? 0)
        : (task.received ?? 0)),
    0
  );
  const remaining = downloads.filter(
    (task) =>
      task.state === DownloadTaskState.Pending ||
      task.state === DownloadTaskState.Downloading ||
      task.state === DownloadTaskState.Verifying ||
      task.state === DownloadTaskState.Paused
  );
  if (!remaining.length) {
    return { etaSecs: undefined, etaSample: undefined };
  }

  let etaSample =
    !sample || done < sample.done || received < (sample.received ?? 0)
      ? { startedAt: now, done, received }
      : sample;
  const elapsed = (now - etaSample.startedAt) / 1000;
  if (elapsed >= 1) {
    // Weight by elapsed time so irregular updates use the same smoothing timescale.
    const alpha = 1 - Math.exp(-elapsed / DOWNLOAD_ETA_SMOOTHING_SECS);
    const smoothRate = (current: number, previous = 0) =>
      previous > 0 ? previous + alpha * (current - previous) : current;
    etaSample = {
      startedAt: now,
      done,
      received,
      filesPerSec: smoothRate(
        (done - etaSample.done) / elapsed,
        etaSample.filesPerSec
      ),
      bytesPerSec:
        etaSample.received == null
          ? undefined
          : smoothRate(
              (received - etaSample.received) / elapsed,
              etaSample.bytesPerSec
            ),
    };
  }

  let remainingBytes = 0;
  let knownFiles = 0;
  let speedBps = 0;
  let unknownFiles = 0;
  let longestEta = 0;
  for (const task of remaining) {
    if (task.state === DownloadTaskState.Verifying) continue;
    const transferring =
      task.state === DownloadTaskState.Downloading &&
      task.received > (task.offset ?? 0);
    const hasEta =
      transferring &&
      task.etaSecs != null &&
      Number.isFinite(task.etaSecs) &&
      task.etaSecs > 0;
    if (task.total > 0) {
      remainingBytes += Math.max(0, task.total - task.received);
      if (task.total > task.received) knownFiles++;
    } else if (!hasEta) {
      unknownFiles++;
    }
    if (transferring) {
      if (Number.isFinite(task.speedBps) && (task.speedBps ?? 0) > 0) {
        speedBps += task.speedBps!;
        if (task.total > task.received) {
          longestEta = Math.max(
            longestEta,
            (task.total - task.received) / task.speedBps!
          );
        }
      }
      if (hasEta) longestEta = Math.max(longestEta, task.etaSecs!);
    }
  }

  // Prefer byte throughput for known sizes. Until byte samples are available,
  // completed-file throughput also covers known files waiting for a connection.
  // A slow connection with actual transfer progress still bounds the group ETA.
  speedBps = Math.max(speedBps, etaSample.bytesPerSec ?? 0);
  const filesPerSec = etaSample.filesPerSec ?? 0;
  const transferEta =
    speedBps > 0
      ? remainingBytes / speedBps
      : filesPerSec > 0
        ? knownFiles / filesPerSec
        : 0;
  const unknownEta = filesPerSec > 0 ? unknownFiles / filesPerSec : 0;
  const etaSecs = Math.ceil(Math.max(longestEta, transferEta + unknownEta));
  return {
    etaSample,
    etaSecs:
      Number.isFinite(etaSecs) && etaSecs > 0 && etaSecs < MAX_DOWNLOAD_ETA_SECS
        ? etaSecs
        : undefined,
  };
};

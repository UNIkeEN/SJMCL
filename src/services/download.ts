import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  DownloadErrorEvent,
  DownloadFinishedEvent,
  DownloadGroupSummary,
  DownloadProgress,
  DownloadStateEvent,
  DownloadTask,
  DownloadVerifiedEvent,
  SubmitDownloadGroup,
} from "@/models/download";

const DOWNLOAD_COMMAND = "plugin:sjmcl-downloader|";

export const DOWNLOAD_TICK_EVENT = "download://tick";
export const DOWNLOAD_STATE_EVENT = "download://state";
export const DOWNLOAD_FINISHED_EVENT = "download://finished";
export const DOWNLOAD_ERROR_EVENT = "download://error";
export const DOWNLOAD_VERIFIED_EVENT = "download://verified";

/**
 * Service class for managing download task groups.
 * Commands reject on backend errors.
 */
export class DownloadService {
  /**
   * SUBMIT a download task group.
   * @param payload - The group name, tasks, and automatic resume setting after application restart.
   * @returns {Promise<string>} The ID assigned to the submitted group.
   */
  static async submitGroup(payload: SubmitDownloadGroup): Promise<string> {
    return await invoke(`${DOWNLOAD_COMMAND}submit_group`, { payload });
  }

  /**
   * PAUSE an active or queued group, preserving partial downloads for resumption.
   * Running tasks stop asynchronously and may still be stopping when the promise resolves.
   * @param groupId - The ID of the group to pause.
   * @returns {Promise<void>}
   */
  static async pauseGroup(groupId: string): Promise<void> {
    return await invoke(`${DOWNLOAD_COMMAND}pause_group`, { groupId });
  }

  /**
   * RESUME a paused group, queuing it if the active group limit is reached.
   * @param groupId - The ID of the group to resume.
   * @returns {Promise<void>}
   */
  static async resumeGroup(groupId: string): Promise<void> {
    return await invoke(`${DOWNLOAD_COMMAND}resume_group`, { groupId });
  }

  /**
   * CANCEL an unfinished group. Running tasks stop asynchronously.
   * @param groupId - The ID of the group to cancel.
   * @returns {Promise<void>} Resolves when cancellation is requested, not when all tasks have stopped.
   */
  static async cancelGroup(groupId: string): Promise<void> {
    return await invoke(`${DOWNLOAD_COMMAND}cancel_group`, { groupId });
  }

  /**
   * RETRY a failed group, reusing completed work unless verification found corrupt files.
   * @param groupId - The ID of the failed group to retry.
   * @returns {Promise<void>}
   */
  static async retryGroup(groupId: string): Promise<void> {
    return await invoke(`${DOWNLOAD_COMMAND}retry_group`, { groupId });
  }

  /**
   * REMOVE a finished group's history record without deleting downloaded files.
   * @param groupId - The ID of the finished group to remove.
   * @returns {Promise<void>}
   */
  static async removeGroup(groupId: string): Promise<void> {
    return await invoke(`${DOWNLOAD_COMMAND}remove_group`, { groupId });
  }

  /**
   * ACKNOWLEDGE that a successfully completed group's follow-up action was handled.
   * Persists the acknowledgement so the action is not replayed after restart.
   * @param groupId - The ID of the successfully completed group.
   * @returns {Promise<void>}
   */
  static async acknowledgeCompletion(groupId: string): Promise<void> {
    return await invoke(`${DOWNLOAD_COMMAND}acknowledge_completion`, {
      groupId,
    });
  }

  /**
   * RETRIEVE summaries of the groups currently loaded by the download engine.
   * @returns {Promise<DownloadGroupSummary[]>} Group states and statistics, without individual tasks.
   */
  static async snapshot(): Promise<DownloadGroupSummary[]> {
    return await invoke(`${DOWNLOAD_COMMAND}snapshot`);
  }

  /**
   * RETRIEVE the tasks in a download group.
   * @param groupId - The ID of the group to inspect.
   * @returns {Promise<DownloadTask[]>}
   */
  static async listTasks(groupId: string): Promise<DownloadTask[]> {
    return await invoke(`${DOWNLOAD_COMMAND}list_tasks`, { groupId });
  }

  /**
   * Listen for batched task progress updates.
   * @returns A promise resolving to the unsubscribe function.
   */
  static onTick(
    callback: (payload: DownloadProgress[]) => void
  ): Promise<() => void> {
    return this.listen(DOWNLOAD_TICK_EVENT, callback);
  }

  /**
   * Listen for group submissions and group or task state changes.
   * @returns A promise resolving to the unsubscribe function.
   */
  static onState(
    callback: (payload: DownloadStateEvent) => void
  ): Promise<() => void> {
    return this.listen(DOWNLOAD_STATE_EVENT, callback);
  }

  /**
   * Listen for group completion, failure, or cancellation.
   * @returns A promise resolving to the unsubscribe function.
   */
  static onFinished(
    callback: (payload: DownloadFinishedEvent) => void
  ): Promise<() => void> {
    return this.listen(DOWNLOAD_FINISHED_EVENT, callback);
  }

  /**
   * Listen for task errors.
   * @returns A promise resolving to the unsubscribe function.
   */
  static onError(
    callback: (payload: DownloadErrorEvent) => void
  ): Promise<() => void> {
    return this.listen(DOWNLOAD_ERROR_EVENT, callback);
  }

  /**
   * Listen for successful task checksum verification.
   * @returns A promise resolving to the unsubscribe function.
   */
  static onVerified(
    callback: (payload: DownloadVerifiedEvent) => void
  ): Promise<() => void> {
    return this.listen(DOWNLOAD_VERIFIED_EVENT, callback);
  }

  /**
   * Subscribe on the current webview and pass event payloads to the callback.
   */
  private static async listen<T>(
    eventName: string,
    callback: (payload: T) => void
  ): Promise<() => void> {
    return await getCurrentWebview().listen<T>(eventName, (event) => {
      callback(event.payload);
    });
  }
}

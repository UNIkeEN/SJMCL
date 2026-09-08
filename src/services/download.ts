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

const DOWNLOAD_COMMAND = "plugin:download|";

export const DOWNLOAD_TICK_EVENT = "download://tick";
export const DOWNLOAD_STATE_EVENT = "download://state";
export const DOWNLOAD_FINISHED_EVENT = "download://finished";
export const DOWNLOAD_ERROR_EVENT = "download://error";
export const DOWNLOAD_VERIFIED_EVENT = "download://verified";

export class DownloadService {
  static async submitGroup(payload: SubmitDownloadGroup): Promise<string> {
    return await invoke(`${DOWNLOAD_COMMAND}submit_group`, { payload });
  }

  static async pauseGroup(groupId: string): Promise<void> {
    return await invoke(`${DOWNLOAD_COMMAND}pause_group`, { groupId });
  }

  static async resumeGroup(groupId: string): Promise<void> {
    return await invoke(`${DOWNLOAD_COMMAND}resume_group`, { groupId });
  }

  static async cancelGroup(groupId: string): Promise<void> {
    return await invoke(`${DOWNLOAD_COMMAND}cancel_group`, { groupId });
  }

  static async retryGroup(groupId: string): Promise<void> {
    return await invoke(`${DOWNLOAD_COMMAND}retry_group`, { groupId });
  }

  static async removeGroup(groupId: string): Promise<void> {
    return await invoke(`${DOWNLOAD_COMMAND}remove_group`, { groupId });
  }

  static async snapshot(): Promise<DownloadGroupSummary[]> {
    return await invoke(`${DOWNLOAD_COMMAND}snapshot`);
  }

  static async listTasks(groupId: string): Promise<DownloadTask[]> {
    return await invoke(`${DOWNLOAD_COMMAND}list_tasks`, { groupId });
  }

  static onTick(callback: (payload: DownloadProgress[]) => void): () => void {
    return this.listen(DOWNLOAD_TICK_EVENT, callback);
  }

  static onState(callback: (payload: DownloadStateEvent) => void): () => void {
    return this.listen(DOWNLOAD_STATE_EVENT, callback);
  }

  static onFinished(
    callback: (payload: DownloadFinishedEvent) => void
  ): () => void {
    return this.listen(DOWNLOAD_FINISHED_EVENT, callback);
  }

  static onError(callback: (payload: DownloadErrorEvent) => void): () => void {
    return this.listen(DOWNLOAD_ERROR_EVENT, callback);
  }

  static onVerified(
    callback: (payload: DownloadVerifiedEvent) => void
  ): () => void {
    return this.listen(DOWNLOAD_VERIFIED_EVENT, callback);
  }

  private static listen<T>(
    eventName: string,
    callback: (payload: T) => void
  ): () => void {
    const unlisten = getCurrentWebview().listen<T>(eventName, (event) => {
      callback(event.payload);
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }
}

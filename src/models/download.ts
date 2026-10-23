export enum DownloadTaskState {
  Pending = "pending",
  Downloading = "downloading",
  Verifying = "verifying",
  Paused = "paused",
  Failed = "failed",
  Done = "done",
  Cancelled = "cancelled",
}

export enum DownloadGroupState {
  Queued = "queued",
  Active = "active",
  Paused = "paused",
  Draining = "draining",
  Finished = "finished",
}

export enum DownloadFinishKind {
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

export interface DownloadError {
  code: string;
  params?: Record<string, string | number | string[]>;
}

export interface DownloadSpec {
  url: string;
  size?: number | null;
}

export interface InstallSpec {
  instanceId: string;
  versionPath: string;
  kind: "mod_loader" | "optifine";
}

export interface PrepareSpec {
  instanceId: string;
  versionPath: string;
}

export interface SubmitDownloadTask {
  name: string;
  executor: "download";
  spec: DownloadSpec;
  dest: string;
  sha1?: string;
  sha256?: string;
}

export interface SubmitDownloadGroup {
  name: string;
  parentGroupId?: string;
  tasks: SubmitDownloadTask[];
  autoResume: boolean;
}

export interface DownloadTask extends Omit<
  SubmitDownloadTask,
  "executor" | "spec" | "dest"
> {
  executor:
    | "download"
    | "prepare_install"
    | "install"
    | "verify"
    | "refresh_java";
  spec: DownloadSpec | PrepareSpec | InstallSpec;
  dest: string | null;
  id: string;
  groupId: string;
  state: DownloadTaskState;
  received: number;
  total: number;
  offset: number;
  attempts: number;
  error: DownloadError | null;
  verified: boolean;
  retriesExhausted: boolean;
  speedBps?: number;
  etaSecs?: number;
  progress?: number;
}

export interface DownloadGroupStats {
  total: number;
  done: number;
  failed: number;
  cancelled: number;
  downloading: number;
  pending: number;
  verified: number;
}

export interface DownloadGroupSummary {
  id: string;
  name: string;
  parentGroupId: string | null;
  state: DownloadGroupState;
  finish: DownloadFinishKind | null;
  completionPending: boolean;
  stats: DownloadGroupStats;
}

export interface DownloadGroup extends DownloadGroupSummary {
  tasks: DownloadTask[];
  progress?: number;
  etaSecs?: number;
  // Frontend throughput sample and smoothed rates for the current active period.
  etaSample?: {
    startedAt: number;
    done: number;
    received?: number;
    filesPerSec?: number;
    bytesPerSec?: number;
  };
  error?: DownloadError;
}

export interface DownloadProgress {
  taskId: string;
  groupId: string;
  state: DownloadTaskState;
  received: number;
  total: number;
  speedBps: number;
  etaSecs: number | null;
}

export type DownloadStateEvent =
  | {
      kind: "group_submitted";
      groupId: string;
    }
  | {
      kind: "task_state_changed";
      groupId: string;
      taskId: string;
      old: DownloadTaskState;
      new: DownloadTaskState;
    }
  | {
      kind: "group_state_changed";
      groupId: string;
      old: DownloadGroupState;
      new: DownloadGroupState;
    };

export interface DownloadFinishedEvent {
  kind: "group_finished";
  groupId: string;
  finish: DownloadFinishKind;
  failedTasks: string[];
  summary: DownloadGroupStats;
}

export interface DownloadErrorEvent {
  kind: "task_failed";
  groupId: string;
  taskId: string;
  error: DownloadError;
}

export interface DownloadVerifiedEvent {
  kind: "task_verified";
  groupId: string;
  taskId: string;
}

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

export type DownloadTaskError =
  | { Network: string }
  | { Http: number }
  | { Io: string }
  | { Checksum: { expected: string; actual: string } }
  | { Other: string };

export interface DownloadSpec {
  url: string;
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
  tasks: SubmitDownloadTask[];
  autoResume: boolean;
}

export interface DownloadTask extends SubmitDownloadTask {
  id: string;
  groupId: string;
  state: DownloadTaskState;
  received: number;
  total: number;
  offset: number;
  attempts: number;
  error: DownloadTaskError | null;
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
  state: DownloadGroupState;
  finish: DownloadFinishKind | null;
  stats: DownloadGroupStats;
}

export interface DownloadGroup extends DownloadGroupSummary {
  tasks: DownloadTask[];
  progress?: number;
  etaSecs?: number;
  error?: string;
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
  error: DownloadTaskError;
}

export interface DownloadVerifiedEvent {
  kind: "task_verified";
  groupId: string;
  taskId: string;
}

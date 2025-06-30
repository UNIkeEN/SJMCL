export enum TaskTypeEnums {
  Download = "download",
}

export type TaskType = `${TaskTypeEnums}`;

export interface DownloadTaskParam {
  taskType: TaskTypeEnums.Download;
  src: string;
  dest: string;
  sha1?: string;
}

export type TaskParam = DownloadTaskParam;

export interface TaskResult {
  taskDescs: TaskDesc[];
  taskGroup: string;
}

export interface DownloadTaskPayload {
  taskType: TaskTypeEnums.Download;
  src: string;
  dest: string;
  sha1: string;
}

export type TaskPayload = DownloadTaskPayload;

export enum TaskDescStateEnums {
  Stopped = "Stopped",
  Cancelled = "Cancelled",
  Completed = "Completed",
  InProgress = "InProgress",
  Failed = "Failed",
}

export interface TaskDesc {
  taskId: number;
  taskGroup: string | null;
  payload: TaskPayload;
  current: number;
  total: number;
  state: TaskDescStateEnums;
  progress?: number;
  isDownloading?: boolean;
  isError?: boolean;
  isWaiting?: boolean;
  isCancelled?: boolean;
  reason?: string;
}

export enum PTaskEventStateEnums {
  Created = "created",
  Started = "started",
  InProgress = "inProgress",
  Completed = "completed",
  Failed = "failed",
  Stopped = "stopped",
  Cancelled = "cancelled",
}

export interface Duration {
  secs: number; // seconds
  nanos: number; // nanoseconds
}

export interface InProgressPTaskEventState {
  state: PTaskEventStateEnums.InProgress;
  percent: number;
  current: number;
  estimatedTime: Duration; // estimated time remaining
}

export interface StartedPTaskEventState {
  state: PTaskEventStateEnums.Started;
  total: number; // total size in bytes
}

export interface CreatedPTaskEventState {
  state: PTaskEventStateEnums.Created;
  desc: TaskDesc; // task description
}

export interface CompletedPTaskEventState {
  state: PTaskEventStateEnums.Completed;
}

export interface FailedPTaskEventState {
  state: PTaskEventStateEnums.Failed;
  reason: string; // error message
}

export interface StoppedPTaskEventState {
  state: PTaskEventStateEnums.Stopped;
}

export interface CancelledPTaskEventState {
  state: PTaskEventStateEnums.Cancelled;
}

export interface PTaskEventPayload {
  id: number;
  taskGroup: string | null;
  event:
    | InProgressPTaskEventState
    | StartedPTaskEventState
    | CreatedPTaskEventState
    | CompletedPTaskEventState
    | FailedPTaskEventState
    | StoppedPTaskEventState
    | CancelledPTaskEventState;
}

export const TaskProgressListener = `SJMCL://task-progress`;

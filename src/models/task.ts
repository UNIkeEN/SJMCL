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

export enum TaskDescStatusEnums {
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
  status: TaskDescStatusEnums;
  progress?: number;
  isDownloading?: boolean;
  isError?: boolean;
  isWaiting?: boolean;
  isCancelled?: boolean;
  reason?: string;
  estimatedTime?: Duration; // estimated time remaining in seconds
}

export enum PTaskEventStatusEnums {
  Created = "Created",
  Started = "Started",
  InProgress = "InProgress",
  Completed = "Completed",
  Failed = "Failed",
  Stopped = "Stopped",
  Cancelled = "Cancelled",
}

export interface Duration {
  secs: number; // seconds
  nanos: number; // nanoseconds
}

export interface InProgressPTaskEventStatus {
  status: PTaskEventStatusEnums.InProgress;
  percent: number;
  current: number;
  estimatedTime: Duration; // estimated time remaining
}

export interface StartedPTaskEventStatus {
  status: PTaskEventStatusEnums.Started;
  total: number; // total size in bytes
}

export interface CreatedPTaskEventStatus {
  status: PTaskEventStatusEnums.Created;
  desc: TaskDesc; // task description
}

export interface CompletedPTaskEventStatus {
  status: PTaskEventStatusEnums.Completed;
}

export interface FailedPTaskEventStatus {
  status: PTaskEventStatusEnums.Failed;
  reason: string; // error message
}

export interface StoppedPTaskEventStatus {
  status: PTaskEventStatusEnums.Stopped;
}

export interface CancelledPTaskEventStatus {
  status: PTaskEventStatusEnums.Cancelled;
}

export interface PTaskEventPayload {
  id: number;
  taskGroup: string | null;
  event:
    | InProgressPTaskEventStatus
    | StartedPTaskEventStatus
    | CreatedPTaskEventStatus
    | CompletedPTaskEventStatus
    | FailedPTaskEventStatus
    | StoppedPTaskEventStatus
    | CancelledPTaskEventStatus;
}

export const TaskProgressListener = `SJMCL://task-progress`;

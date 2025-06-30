import { Event } from "@tauri-apps/api/event";

export enum TaskTypeEnums {
  Download = "Download",
}

export type TaskType = `${TaskTypeEnums}`;

export interface DownloadTaskParam {
  task_type: TaskTypeEnums.Download;
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
  task_type: TaskTypeEnums.Download;
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

export enum PTaskEventPayloadStateEnums {
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

export interface InProgressPTaskEventPayload {
  state: PTaskEventPayloadStateEnums.InProgress;
  percent: number;
  current: number;
  estimatedTime: Duration; // estimated time remaining
}

export interface StartedPTaskEventPayload {
  state: PTaskEventPayloadStateEnums.Started;
  total: number; // total size in bytes
}

export interface CreatedPTaskEventPayload {
  state: PTaskEventPayloadStateEnums.Created;
}

export interface CompletedPTaskEventPayload {
  state: PTaskEventPayloadStateEnums.Completed;
}

export interface FailedPTaskEventPayload {
  state: PTaskEventPayloadStateEnums.Failed;
  reason: string; // error message
}

export interface StoppedPTaskEventPayload {
  state: PTaskEventPayloadStateEnums.Stopped;
}

export interface CancelledPTaskEventPayload {
  state: PTaskEventPayloadStateEnums.Cancelled;
}

export interface PTaskEventPayload {
  id: number;
  task_group: string | null;
  event:
    | InProgressPTaskEventPayload
    | StartedPTaskEventPayload
    | CreatedPTaskEventPayload
    | CompletedPTaskEventPayload
    | FailedPTaskEventPayload
    | StoppedPTaskEventPayload
    | CancelledPTaskEventPayload;
}

export type PTaskEvent = Event<PTaskEventPayload>;

export const TaskProgressListener = `SJMCL://task-progress`;

export enum TaskTypeEnums {
  Download = "Download",
}

export type TaskType = `${TaskTypeEnums}`;

export interface DownloadRuntimeTaskParam {
  type: TaskTypeEnums.Download;
  src: string;
  dest: string; // destination path
  filename?: string; // destination filename
  sha1?: string;
}

export type RuntimeTaskParam = DownloadRuntimeTaskParam;

export interface DownloadTaskPayload {
  taskType: TaskTypeEnums.Download;
  src: string;
  dest: string; // destination path
  filename: string; // destination filename
  sha1: string;
}

export type TaskPayload = DownloadTaskPayload;

export enum RuntimeStateEnums {
  Stopped = "Stopped",
  Cancelled = "Cancelled",
  Completed = "Completed",
  InProgress = "InProgress",
  Failed = "Failed",
  Waiting = "Waiting",
}

export interface StoppedRuntimeState {
  type: RuntimeStateEnums.Stopped;
  stoppedAt: number;
}

export interface FailedRuntimeState {
  type: RuntimeStateEnums.Failed;
  reason: string;
}

export interface InProgressRuntimeState {
  type: RuntimeStateEnums.InProgress;
}

export interface CompletedRuntimeState {
  type: RuntimeStateEnums.Completed;
  completedAt: number;
}

export interface CancelledRuntimeState {
  type: RuntimeStateEnums.Cancelled;
}

export interface PendingRuntimeState {
  type: RuntimeStateEnums.Waiting;
}

export type RuntimeState =
  | StoppedRuntimeState
  | FailedRuntimeState
  | InProgressRuntimeState
  | CompletedRuntimeState
  | CancelledRuntimeState
  | PendingRuntimeState;

export interface RuntimeTaskDescSnapshot {
  state: RuntimeState;
  total: number;
  current: number;
  startAt: number;
  createdAt: number;
  filename: string;
  dest: string;
}

export interface RuntimeGroupDescSnapshot {
  name: string;
  taskDescMap: Map<number, RuntimeTaskDescSnapshot>;
}

export interface TaskDesc {
  taskId: number;
  status: RuntimeStateEnums;
  total: number;
  current: number;
  startAt: number;
  createdAt: number;
  filename: string;
  dest: string;
  progress?: number;
  reason?: string;
  estimatedTime?: Duration; // estimated time remaining in seconds
  speed?: number; // speed in bytes per second
}

export interface TaskGroupDesc {
  taskDescs: TaskDesc[];
  taskGroup: string;
  status: RuntimeStateEnums;
  finishedCount: number;
  progress: number;
  reason?: string;
  estimatedTime?: Duration;
}

export enum TaskEventPayloadEnums {
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

export interface InProgressTaskEventPayload {
  status: TaskEventPayloadEnums.InProgress;
  percent: number;
  current: number;
  estimatedTime?: Duration; // estimated time remaining
  speed: number; // speed in bytes per second
}

export interface StartedTaskEventPayload {
  status: TaskEventPayloadEnums.Started;
  total: number; // total size in bytes
}

export interface CompletedTaskEventPayload {
  status: TaskEventPayloadEnums.Completed;
}

export interface FailedTaskEventPayload {
  status: TaskEventPayloadEnums.Failed;
  reason: string; // error message
}

export interface StoppedTaskEventPayload {
  status: TaskEventPayloadEnums.Stopped;
}

export interface CancelledTaskEventPayload {
  status: TaskEventPayloadEnums.Cancelled;
}

export interface TaskEvent {
  id: number;
  taskGroup: string;
  event:
    | InProgressTaskEventPayload
    | StartedTaskEventPayload
    | CompletedTaskEventPayload
    | FailedTaskEventPayload
    | StoppedTaskEventPayload
    | CancelledTaskEventPayload;
}

export enum GroupEventPayloadEnums {
  Started = "Started",
  Failed = "Failed",
  Completed = "Completed",
  Stopped = "Stopped",
  Cancelled = "Cancelled",
}

export interface GroupEvent {
  taskGroup: string;
  event: GroupEventPayloadEnums;
}

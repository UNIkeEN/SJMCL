export interface DownloadTaskParam {
  src: string;
  dest: string;
  sha1?: string;
}

export type TaskParam = DownloadTaskParam;

export interface TaskResult {
  taskIds: number;
  taskGroup: string;
}

export enum TaskType {
  Download = 0,
  // Future: Add other types here
}

export enum MonitorState {
  InProgress = 0,
  Stopped = 1,
  Completed = 2,
  Cancelled = 3,
}

export interface TaskState {
  taskId: number;
  taskGroup: string | null;
  taskType: TaskType;
  current: number;
  total: number;
  storePath: string;
  taskParam: TaskParam;
  state: MonitorState;
  progress?: number;
  isDownloading?: boolean;
  isError?: boolean;
  isWaiting?: boolean;
}

// TODO: refactor frontend mock type below
export interface DownloadTaskItem {
  id: number;
  fileName?: string;
  src: string;
  target: string;
  isWaiting: boolean;
  speed: number;
  totalSize: number;
  finishedSize: number;
}

export interface DownloadTask {
  id: number;
  name: string;
  items: DownloadTaskItem[];
  isDownloading: boolean; // false = paused
  isWaiting: boolean; // not paused, but waiting
  isError: boolean;
  speed: number; // in bytes per second
  progress: number; // 0-100
  elapsedTime: number; // in seconds
}

export interface DownloadTaskParam {
  src: string;
  dest: string;
}

export type TaskParam = DownloadTaskParam;

export interface TaskResult {
  taskIds: number;
  taskGroup: string;
}

export interface TaskState {
  taskId: number;
  taskGroup: string;
  taskType: number; // TODO: enum
  current: number;
  total: number;
  path: string;
  taskParam: TaskParam;
  monitorState: number; // TODO: enum
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

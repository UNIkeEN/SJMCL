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

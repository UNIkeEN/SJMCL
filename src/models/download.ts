export interface TaskParam {
  task_type: string;
  [key: string]: any;
}

export interface DownloadParam extends TaskParam {
  task_type: "Download";
  src: string;
  dest: string;
}

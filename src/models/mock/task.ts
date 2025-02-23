import { DownloadTask } from "../task";

export const mockDownloadTasks: DownloadTask[] = [
  {
    id: 1,
    name: "Task 1",
    isDownloading: true,
    isWaiting: false,
    isError: false,
    speed: 2333333,
    progress: 40,
    elapsedTime: 9999,
    items: [
      {
        id: 101,
        fileName: "file1.zip",
        src: "https://example.com/file1.zip",
        target: "/downloads/file1.zip",
        isWaiting: false,
        speed: 1145141919,
        totalSize: 1000000,
        finishedSize: 400000,
      },
      {
        id: 102,
        fileName: "file2.zip",
        src: "https://example.com/file2.zip",
        target: "/downloads/file2.zip",
        isWaiting: false,
        speed: 114514,
        totalSize: 5000000,
        finishedSize: 2000000,
      },
      {
        id: 103,
        fileName: "file222.zip",
        src: "https://example.com/file222.zip",
        target: "/downloads/file222.zip",
        isWaiting: false,
        speed: 514,
        totalSize: 5000000,
        finishedSize: 2000000,
      },
    ],
  },
  {
    id: 2,
    name: "Task 2",
    isDownloading: false,
    isWaiting: false,
    isError: false,
    speed: 0,
    progress: 100,
    elapsedTime: 10086,
    items: [
      {
        id: 201,
        fileName: "file3.jpg",
        src: "https://example.com/file3.jpg",
        target: "/downloads/file3.jpg",
        isWaiting: false,
        speed: 0,
        totalSize: 2000000, // 2 MB
        finishedSize: 2000000, // 2 MB (completed)
      },
    ],
  },
  {
    id: 3,
    name: "Task 3",
    isDownloading: false,
    isWaiting: true,
    isError: true,
    speed: 0,
    progress: 0,
    elapsedTime: 2333,
    items: [
      {
        id: 301,
        fileName: "file4.mp4",
        src: "https://example.com/file4.mp4",
        target: "/downloads/file4.mp4",
        isWaiting: true,
        speed: 0,
        totalSize: 8000000, // 8 MB
        finishedSize: 0, // Not started
      },
      {
        id: 302,
        fileName: "file5.mp4",
        src: "https://example.com/file5.mp4",
        target: "/downloads/file5.mp4",
        isWaiting: true,
        speed: 0,
        totalSize: 10000000, // 10 MB
        finishedSize: 0, // Not started
      },
    ],
  },
  {
    id: 4,
    name: "Task 4",
    isDownloading: false,
    isWaiting: false,
    isError: false,
    speed: 0,
    progress: 100,
    elapsedTime: 10086,
    items: [
      {
        id: 201,
        fileName: "file3.jpg",
        src: "https://example.com/file3.jpg",
        target: "/downloads/file3.jpg",
        isWaiting: false,
        speed: 0,
        totalSize: 2000000, // 2 MB
        finishedSize: 2000000, // 2 MB (completed)
      },
    ],
  },
  {
    id: 5,
    name: "Task 5",
    isDownloading: true,
    isWaiting: false,
    isError: false,
    speed: 521021910000,
    progress: 57,
    elapsedTime: 20,
    items: [
      {
        id: 201,
        fileName: "file3.jpg",
        src: "https://example.com/file3.jpg",
        target: "/downloads/file3.jpg",
        isWaiting: false,
        speed: 2331919810,
        totalSize: 2000000, // 2 MB
        finishedSize: 2000000, // 2 MB (completed)
      },
    ],
  },
];

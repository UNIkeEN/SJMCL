import {
  type DownloadGroup,
  DownloadGroupState,
  type DownloadGroupStats,
  type DownloadTask,
  DownloadTaskState,
} from "@/models/download";

export const getDownloadStats = (tasks: DownloadTask[]): DownloadGroupStats => {
  const downloads = tasks.filter((task) => task.executor === "download");
  return {
    total: downloads.length,
    done: downloads.filter((task) => task.state === DownloadTaskState.Done)
      .length,
    failed: downloads.filter((task) => task.state === DownloadTaskState.Failed)
      .length,
    cancelled: downloads.filter(
      (task) => task.state === DownloadTaskState.Cancelled
    ).length,
    downloading: downloads.filter(
      (task) =>
        task.state === DownloadTaskState.Downloading ||
        task.state === DownloadTaskState.Verifying
    ).length,
    pending: downloads.filter(
      (task) =>
        task.state === DownloadTaskState.Pending ||
        task.state === DownloadTaskState.Paused
    ).length,
    verified: downloads.filter((task) => task.verified).length,
  };
};

export const estimateDownloadGroupEta = (
  state: DownloadGroupState,
  tasks: DownloadTask[],
  sample?: DownloadGroup["etaSample"],
  now = performance.now()
): Pick<DownloadGroup, "etaSecs" | "etaSample"> => {
  if (
    state !== DownloadGroupState.Active ||
    tasks.some(
      (task) => task.state === DownloadTaskState.Failed && task.retriesExhausted
    )
  ) {
    return { etaSecs: undefined, etaSample: undefined };
  }

  const downloads = tasks.filter((task) => task.executor === "download");
  const done = downloads.filter(
    (task) => task.state === DownloadTaskState.Done
  ).length;
  const received = downloads.reduce(
    (sum, task) =>
      sum +
      (task.state === DownloadTaskState.Done
        ? Math.max(task.received ?? 0, task.total ?? 0)
        : (task.received ?? 0)),
    0
  );
  const remaining = downloads.filter(
    (task) =>
      task.state === DownloadTaskState.Pending ||
      task.state === DownloadTaskState.Downloading ||
      task.state === DownloadTaskState.Verifying ||
      task.state === DownloadTaskState.Paused
  );
  if (!remaining.length) {
    return { etaSecs: undefined, etaSample: undefined };
  }

  let etaSample =
    !sample || done < sample.done || received < (sample.received ?? 0)
      ? { startedAt: now, done, received }
      : sample;
  const elapsed = (now - etaSample.startedAt) / 1000;
  if (elapsed >= 1) {
    etaSample = {
      startedAt: now,
      done,
      received,
      filesPerSec: (done - etaSample.done) / elapsed,
      bytesPerSec:
        etaSample.received == null
          ? undefined
          : (received - etaSample.received) / elapsed,
    };
  }

  let remainingBytes = 0;
  let speedBps = 0;
  let unknownFiles = 0;
  let longestEta = 0;
  for (const task of remaining) {
    if (task.state === DownloadTaskState.Verifying) continue;
    const hasEta =
      task.state === DownloadTaskState.Downloading &&
      task.etaSecs != null &&
      Number.isFinite(task.etaSecs) &&
      task.etaSecs > 0;
    if (task.total > 0) {
      remainingBytes += Math.max(0, task.total - task.received);
    } else if (!hasEta) {
      unknownFiles++;
    }
    if (task.state === DownloadTaskState.Downloading) {
      if (Number.isFinite(task.speedBps) && (task.speedBps ?? 0) > 0) {
        speedBps += task.speedBps!;
        if (task.total > task.received) {
          longestEta = Math.max(
            longestEta,
            (task.total - task.received) / task.speedBps!
          );
        }
      }
      if (hasEta) longestEta = Math.max(longestEta, task.etaSecs!);
    }
  }

  // Use bytes for known files, and recent completion throughput only for unknown
  // files. A slow active connection remains a lower bound on the group ETA.
  speedBps = Math.max(speedBps, etaSample.bytesPerSec ?? 0);
  const transferEta = speedBps > 0 ? remainingBytes / speedBps : 0;
  const unknownEta =
    (etaSample.filesPerSec ?? 0) > 0
      ? unknownFiles / etaSample.filesPerSec!
      : 0;
  const etaSecs = Math.max(longestEta, transferEta + unknownEta);
  return {
    etaSample,
    etaSecs: etaSecs > 0 ? Math.ceil(etaSecs) : undefined,
  };
};

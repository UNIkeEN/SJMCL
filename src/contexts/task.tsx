import { useToast as useChakraToast } from "@chakra-ui/react";
import { emit } from "@tauri-apps/api/event";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { toastKey, useToast } from "@/contexts/toast";
import { OtherResourceType } from "@/enums/resource";
import {
  CreatedPTaskEventStatus,
  FailedPTaskEventStatus,
  GTaskEventPayload,
  GTaskEventStatusEnums,
  InProgressPTaskEventStatus,
  PTaskEventPayload,
  PTaskEventStatusEnums,
  StartedPTaskEventStatus,
  TaskDesc,
  TaskDescStatusEnums,
  TaskGroupDesc,
  TaskParam,
} from "@/models/task";
import { ConfigService } from "@/services/config";
import {
  EXTENSION_REFRESH_EVENT,
  ExtensionService,
} from "@/services/extension";
import { InstanceService } from "@/services/instance";
import { RESOURCE_REFRESH_EVENT } from "@/services/resource";
import { TaskService } from "@/services/task";

interface TaskContextType {
  tasks: TaskGroupDesc[];
  generalPercent: number | undefined; // General progress percentage for all tasks
  handleScheduleProgressiveTaskGroup: (
    taskGroup: string,
    params: TaskParam[]
  ) => void;
  handleCancelProgressiveTaskGroup: (taskGroup: string) => void;
  handleStopProgressiveTaskGroup: (taskGroup: string) => void;
  handleResumeProgressiveTaskGroup: (taskGroup: string) => void;
  handleClearHistoryTaskGroups: () => void;
}

export const TaskContext = createContext<TaskContextType | undefined>(
  undefined
);

export const TaskContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const toast = useToast();
  const { close: closeToast } = useChakraToast();
  const { getInstanceList } = useGlobalData();
  const { config, getJavaInfos } = useLauncherConfig();
  const { openSharedModal, openGenericConfirmDialog } = useSharedModals();
  const [tasks, setTasks] = useState<TaskGroupDesc[]>([]);
  const [generalPercent, setGeneralPercent] = useState<number>();
  const { t } = useTranslation();
  // Instances whose post-download install step is already running. Keyed per
  // instance so different instances install concurrently, while duplicate task
  // groups for the same instance trigger the install only once.
  const finishingInstalls = React.useRef(new Set<string>());

  const updateGroupInfo = useCallback((group: TaskGroupDesc) => {
    if (group.status === GTaskEventStatusEnums.Completed) {
      group.taskDescs.forEach((t) => {
        t.status = TaskDescStatusEnums.Completed;
        t.current = t.total; // Ensure current is set to total for completed tasks
      });
    }

    group.finishedCount = group.taskDescs.filter(
      (t) => t.status === TaskDescStatusEnums.Completed
    ).length;

    let knownTotalArr = group.taskDescs.filter((t) => t.total && t.total > 0);
    let knownTotal = knownTotalArr.reduce((acc, t) => acc + t.total, 0);
    let knownCurrent = knownTotalArr.reduce(
      (acc, t) => acc + (t.current || 0),
      0
    );
    let estimatedTotal;
    if (knownTotalArr.length > 0) {
      estimatedTotal =
        knownTotal +
        (group.taskDescs.length - knownTotalArr.length) *
          (knownTotal / knownTotalArr.length); // Estimate unknown task's size based on known tasks' average size
      group.progress = (knownCurrent * 100) / estimatedTotal;
    } else if (group.taskDescs.length > 0) {
      // No download reported a known size (server omitted Content-Length, or the
      // task is still connecting). Fall back to how many files have finished so
      // the group bar still advances as each file completes instead of staying
      // pinned at 0.
      group.progress = (group.finishedCount / group.taskDescs.length) * 100;
    } else {
      estimatedTotal = knownTotal; // 0
      group.progress = 0;
    }

    group.estimatedTime = undefined;
    group.taskDescs.forEach((t) => {
      if (t.status === TaskDescStatusEnums.InProgress && t.estimatedTime) {
        if (
          !group.estimatedTime ||
          group.estimatedTime.secs < t.estimatedTime.secs
        ) {
          group.estimatedTime = t.estimatedTime;
        }
      }
      t.progress = t.total ? (t.current * 100) / t.total : 0;
    });
    group.taskDescs.sort((a, b) => {
      let level = (desc: TaskDesc) => {
        switch (desc.status) {
          case TaskDescStatusEnums.Failed:
            return 0;
          case TaskDescStatusEnums.InProgress:
            return 1;
          case TaskDescStatusEnums.Waiting:
            return 2;
          case TaskDescStatusEnums.Completed:
            return 4;
          default:
            return 3;
        }
      };
      return level(a) - level(b);
    });
  }, []);

  // Throttle high-frequency progress updates. A large modpack fires an
  // InProgress event for every file every second; without coalescing, the
  // whole task tree is re-mapped and re-sorted on every event, which janks the
  // UI. Structural events (created/completed/failed/...) bypass this and update
  // immediately so nothing is dropped.
  const progressFlushTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const flushProgressUpdate = React.useCallback(
    (updater: (prev: TaskGroupDesc[]) => TaskGroupDesc[]) => {
      if (progressFlushTimer.current) return;
      progressFlushTimer.current = setTimeout(() => {
        progressFlushTimer.current = null;
        setTasks(updater);
      }, 200);
    },
    []
  );

  const handleRetrieveProgressTasks = useCallback(() => {
    TaskService.retrieveProgressiveTaskList().then((response) => {
      if (response.status === "success") {
        logger.info("Retrieved progressive tasks:", response.data);
        // info(JSON.stringify(response.data));
        setTasks((prevTasks) => {
          let tasks = response.data
            .map((group) => {
              let prevGroup = prevTasks?.find(
                (t) => t.taskGroup === group.taskGroup
              );
              if (prevGroup) return prevGroup;
              updateGroupInfo(group);
              return group;
            })
            .filter(
              (group) => group.status !== GTaskEventStatusEnums.Cancelled
            );
          tasks.sort((a, b) => {
            let { timestamp: aTime } = parseTaskGroup(a.taskGroup);
            let { timestamp: bTime } = parseTaskGroup(b.taskGroup);
            return bTime - aTime; // Sort by timestamp descending
          });
          return tasks;
        });
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  }, [toast, updateGroupInfo]);

  useEffect(() => {
    handleRetrieveProgressTasks();
  }, [handleRetrieveProgressTasks]);

  const handleScheduleProgressiveTaskGroup = useCallback(
    (taskGroup: string, params: TaskParam[]) => {
      TaskService.scheduleProgressiveTaskGroup(taskGroup, params).then(
        (response) => {
          // success toast will now be called by task context group listener
          if (response.status !== "success") {
            toast({
              id: toastKey("schedule-failed", taskGroup),
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        }
      );
    },
    [toast]
  );

  const handleCancelProgressiveTaskGroup = useCallback(
    (taskGroup: string) => {
      TaskService.cancelProgressiveTaskGroup(taskGroup).then((response) => {
        if (response.status !== "success") {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
      });
    },
    [toast]
  );

  const handleStopProgressiveTaskGroup = useCallback(
    (taskGroup: string) => {
      TaskService.stopProgressiveTaskGroup(taskGroup).then((response) => {
        if (response.status !== "success") {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
      });
    },
    [toast]
  );

  const handleResumeProgressiveTaskGroup = useCallback(
    (taskGroup: string) => {
      TaskService.resumeProgressiveTaskGroup(taskGroup).then((response) => {
        if (response.status !== "success") {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
      });
    },
    [toast]
  );

  const handleClearHistoryTaskGroups = useCallback(() => {
    setTasks((prev) => {
      prev
        .filter((t) => !isActiveGroup(t))
        .forEach((group) => {
          TaskService.deleteProgressiveTaskGroup(group.taskGroup);
        });
      return prev.filter(isActiveGroup);
    });
  }, []);

  useEffect(() => {
    const unlisten = TaskService.onProgressiveTaskUpdate(
      (payload: PTaskEventPayload) => {
        // info(
        //   `Received task update: ${payload.id}, status: ${payload.event.status}`
        // );
        setTasks((prevTasks) => {
          const group = prevTasks?.find(
            (t) => t.taskGroup === payload.taskGroup
          );

          switch (payload.event.status) {
            case PTaskEventStatusEnums.Created: {
              if (group) {
                if (group.taskDescs.some((t) => t.taskId === payload.id)) {
                  // info(
                  //   `Task ${payload.id} already exists in group ${payload.taskGroup}`
                  // );
                } else if (
                  group.taskDescs.some(
                    (t) =>
                      t.payload.dest ===
                      (payload.event as CreatedPTaskEventStatus).desc.payload
                        .dest
                  )
                ) {
                  // It' a retrial task emitted from the backend
                  group.taskDescs = group.taskDescs.map((t) => {
                    if (
                      t.payload.dest ===
                      (payload.event as CreatedPTaskEventStatus).desc.payload
                        .dest
                    ) {
                      t = (payload.event as CreatedPTaskEventStatus).desc;
                    }
                    return t;
                  });
                } else {
                  group.taskDescs.unshift(payload.event.desc);
                  // info(`Added task ${payload.id} to group ${payload.taskGroup}`);
                  updateGroupInfo(group);
                }
              } else {
                // info(`Creating new task group ${payload.taskGroup}`);
                // Create a new task group if it doesn't exist
                let newGroup: TaskGroupDesc = {
                  status: GTaskEventStatusEnums.Started,
                  taskGroup: payload.taskGroup,
                  taskDescs: [payload.event.desc],
                };
                updateGroupInfo(newGroup);
                return capGroups([newGroup, ...(prevTasks || [])]);
              }
              break;
            }

            case PTaskEventStatusEnums.Started: {
              if (!group) return prevTasks;
              group.taskDescs = group.taskDescs.map((t) => {
                if (t.taskId === payload.id) {
                  t.status = TaskDescStatusEnums.InProgress;
                  t.total = (payload.event as StartedPTaskEventStatus).total;
                }
                return t;
              });
              updateGroupInfo(group);
              break;
            }

            case PTaskEventStatusEnums.Completed: {
              if (!group) return prevTasks;
              group.taskDescs = group.taskDescs.map((t) => {
                if (t.taskId === payload.id) {
                  t.status = TaskDescStatusEnums.Completed;
                  t.current = t.total;
                }
                return t;
              });
              // info(`Task ${payload.id} completed in group ${payload.taskGroup}`);
              updateGroupInfo(group);
              break;
            }

            case PTaskEventStatusEnums.Stopped: {
              if (!group) return prevTasks;
              group.taskDescs = group.taskDescs.map((t) => {
                if (t.taskId === payload.id) {
                  t.status = TaskDescStatusEnums.Stopped;
                }
                return t;
              });
              updateGroupInfo(group);
              break;
            }

            case PTaskEventStatusEnums.Cancelled: {
              if (!group) return prevTasks;
              group.taskDescs = group.taskDescs.map((t) => {
                if (t.taskId === payload.id) {
                  t.status = TaskDescStatusEnums.Cancelled;
                }
                return t;
              });
              updateGroupInfo(group);
              // info(`Task ${payload.id} cancelled in group ${payload.taskGroup}`);
              break;
            }

            case PTaskEventStatusEnums.InProgress: {
              if (!group) return prevTasks;
              group.taskDescs = group.taskDescs.map((t) => {
                if (t.taskId === payload.id) {
                  t.current = (
                    payload.event as InProgressPTaskEventStatus
                  ).current;
                  t.status = TaskDescStatusEnums.InProgress;
                  t.estimatedTime = (
                    payload.event as InProgressPTaskEventStatus
                  ).estimatedTime;
                  t.speed = (payload.event as InProgressPTaskEventStatus).speed;
                }
                return t;
              });
              // Coalesce: mutate the data in place but skip the per-event
              // re-render by returning the same array reference (React bails
              // out). The throttled flush below recomputes the per-group
              // derived stats (finishedCount / progress / sort) once and
              // triggers a single refresh, instead of sorting and reducing
              // the whole group on every progress tick. Without this, a
              // large modpack re-sorts hundreds of tasks every second and
              // starves UI input (the multi-second page-switch lag).
              flushProgressUpdate((prevGroups) => {
                prevGroups.forEach((g) => updateGroupInfo(g));
                return [...prevGroups];
              });
              return prevTasks;
            }

            case PTaskEventStatusEnums.Failed: {
              logger.error(
                `Task ${payload.id} failed in group ${payload.taskGroup}: ${
                  (payload.event as FailedPTaskEventStatus).reason
                }`
              );
              if (!group) return prevTasks;
              group.taskDescs = group.taskDescs.map((t) => {
                if (t.taskId === payload.id) {
                  t.status = TaskDescStatusEnums.Failed;
                  t.reason = (payload.event as FailedPTaskEventStatus).reason;
                }
                return t;
              });
              updateGroupInfo(group);
              // info(`Task ${payload.id} failed in group ${payload.taskGroup}`);
              break;
            }

            default:
              break;
          }

          return [...prevTasks];
        });
      }
    );

    return () => {
      unlisten();
    };
  }, [t, toast, updateGroupInfo, flushProgressUpdate]);

  useEffect(() => {
    const unlisten = TaskService.onTaskGroupUpdate(
      (payload: GTaskEventPayload) => {
        logger.info(`Received task group update: ${payload.event}`);
        setTasks((prevTasks) => {
          let newTasks = prevTasks.map((task) => {
            if (task.taskGroup === payload.taskGroup) {
              task.status = payload.event;
              if (payload.event === GTaskEventStatusEnums.Completed) {
                task.taskDescs.forEach((t) => {
                  if (
                    t.status === TaskDescStatusEnums.Waiting ||
                    t.status === TaskDescStatusEnums.InProgress
                  ) {
                    t.status = TaskDescStatusEnums.Completed;
                    t.current = t.total;
                  } else if (t.status === TaskDescStatusEnums.Failed) {
                    task.status = GTaskEventStatusEnums.Failed;
                    payload.event = GTaskEventStatusEnums.Failed;
                  }
                });
              }
            }
            return task;
          });

          newTasks = capGroups(newTasks);

          const { name, params } = parseTaskGroup(payload.taskGroup);

          // Key on group + outcome: the same group reports once per duplicate
          // copy, and refreshes can emit the same completion repeatedly. One
          // toast per actual outcome.
          toast({
            id: toastKey("group-update", payload.event, payload.taskGroup),
            status:
              payload.event === GTaskEventStatusEnums.Failed
                ? "error"
                : "success",
            title: t(
              `Services.task.onTaskGroupUpdate.status.${payload.event}`,
              {
                param: t(`DownloadTasksPage.task.${name}`, params),
              }
            ),
          });

          if (payload.event === GTaskEventStatusEnums.Completed) {
            switch (name) {
              case "game-client":
              case "change-mod-loader":
                getInstanceList(true);
                break;
              case "change-optifine":
                getInstanceList(true);
                break;
              case "game-client-w-java":
                getInstanceList(true);
                getJavaInfos(true);
                break;
              case "forge-libraries":
              case "cleanroom-libraries":
              case "neoforge-libraries":
                if (params.param || params.param1) {
                  const instanceId = params.param || params.param1;
                  let instanceName = getInstanceList()?.find(
                    (i) => i.id === instanceId
                  )?.name;
                  // Per-instance guard, not a single global ref: different
                  // instances must be able to finish concurrently, while the
                  // same instance completing through several duplicate groups
                  // must trigger the install only once.
                  if (finishingInstalls.current.has(instanceId))
                    return newTasks;
                  finishingInstalls.current.add(instanceId);
                  const loadingId = toast({
                    title: t(
                      "Services.instance.finishModLoaderInstall.loading",
                      {
                        instanceName,
                      }
                    ),
                    status: "loading",
                  });
                  InstanceService.finishModLoaderInstall(instanceId).then(
                    (response) => {
                      closeToast(loadingId);
                      finishingInstalls.current.delete(instanceId);
                      if (response.status === "success") {
                        getInstanceList(true);
                        toast({
                          id: toastKey("finish-mod-loader", "ok", instanceId),
                          title: response.message,
                          status: "success",
                        });
                      } else {
                        toast({
                          id: toastKey(
                            "finish-mod-loader",
                            "failed",
                            instanceId
                          ),
                          title: response.message,
                          description: response.details,
                          status: "error",
                        });
                      }
                    }
                  );
                }
                break;
              case "optifine-libraries":
                if (params.param || params.param1) {
                  const instanceId = params.param || params.param1;
                  let instanceName = getInstanceList()?.find(
                    (i) => i.id === instanceId
                  )?.name;
                  if (finishingInstalls.current.has(instanceId))
                    return newTasks;
                  finishingInstalls.current.add(instanceId);
                  const loadingId = toast({
                    title: t(
                      "Services.instance.finishOptiFineLoaderInstall.loading",
                      {
                        instanceName,
                      }
                    ),
                    status: "loading",
                  });
                  InstanceService.finishOptiFineLoaderInstall(instanceId).then(
                    (response) => {
                      closeToast(loadingId);
                      finishingInstalls.current.delete(instanceId);
                      if (response.status === "success") {
                        getInstanceList(true);
                        toast({
                          id: toastKey("finish-optifine", "ok", instanceId),
                          title: response.message,
                          status: "success",
                        });
                      } else {
                        toast({
                          id: toastKey("finish-optifine", "failed", instanceId),
                          title: response.message,
                          description: response.details,
                          status: "error",
                        });
                      }
                    }
                  );
                }
                break;
              case "mod":
              case "mod-update":
                emit(RESOURCE_REFRESH_EVENT, OtherResourceType.Mod);
                break;
              case "resourcepack":
                emit(RESOURCE_REFRESH_EVENT, OtherResourceType.ResourcePack);
                break;
              case "shader":
                emit(RESOURCE_REFRESH_EVENT, OtherResourceType.ShaderPack);
                break;
              case "modpack": {
                let group = newTasks.find(
                  (t) => t.taskGroup === payload.taskGroup
                );
                if (group && group.taskDescs.length > 0) {
                  openSharedModal("import-modpack", {
                    path: group.taskDescs[0].payload.dest,
                  });
                }
                break;
              }
              case "launcher-update": {
                let group = newTasks.find(
                  (t) => t.taskGroup === payload.taskGroup
                );
                if (group && group.taskDescs.length > 0) {
                  const isWinInstaller =
                    config.basicInfo.osType === "windows" &&
                    !config.basicInfo.isPortable;
                  openGenericConfirmDialog({
                    title: t("RestartForUpdateConfirmDialog.title"),
                    body: t(
                      `RestartForUpdateConfirmDialog.${isWinInstaller ? "bodyWinInstaller" : "body"}`
                    ),
                    btnOK: t(
                      `RestartForUpdateConfirmDialog.button.${isWinInstaller ? "install" : "restart"}`
                    ),
                    btnCancel: t("RestartForUpdateConfirmDialog.button.later"),
                    onOKCallback: () => {
                      ConfigService.installLauncherUpdate(
                        group.taskDescs[0].payload.filename || "",
                        true
                      ).then((response) => {
                        if (response.status !== "success") {
                          toast({
                            title: response.message,
                            description: response.details,
                            status: "error",
                          });
                        }
                      });
                    },
                    onCancelCallback: () => {
                      ConfigService.installLauncherUpdate(
                        group.taskDescs[0].payload.filename || "",
                        false
                      ).then((response) => {
                        if (response.status !== "success") {
                          toast({
                            title: response.message,
                            description: response.details,
                            status: "error",
                          });
                        }
                      });
                    },
                  });
                }
                break;
              }
              case "extension-update": {
                let group = newTasks.find(
                  (t) => t.taskGroup === payload.taskGroup
                );
                const task = group?.taskDescs[0];
                const expectedIdentifier = params.param1;
                const newVersion = params.param2 || "";

                if (task && expectedIdentifier) {
                  openGenericConfirmDialog({
                    title: t("ExtensionUpdateConfirmDialog.title"),
                    body: t("ExtensionUpdateConfirmDialog.body", {
                      identifier: expectedIdentifier,
                      version: newVersion,
                      src: task.payload.src,
                    }),
                    onOKCallback: () => {
                      ExtensionService.addExtension(
                        task.payload.dest,
                        expectedIdentifier
                      ).then((response) => {
                        if (response.status === "success") {
                          toast({
                            title: response.message,
                            status: "success",
                          });
                          emit(EXTENSION_REFRESH_EVENT);
                        } else {
                          toast({
                            title: response.message,
                            description: response.details,
                            status: "error",
                          });
                        }
                      });
                    },
                  });
                }
                break;
              }
              case "mojang-java":
                getJavaInfos(true);
                break;
              default:
                break;
            }
          }

          return newTasks;
        });
      }
    );
    return () => {
      unlisten();
    };
  }, [
    t,
    toast,
    closeToast,
    getInstanceList,
    updateGroupInfo,
    flushProgressUpdate,
    getJavaInfos,
    openSharedModal,
    openGenericConfirmDialog,
    config.basicInfo.osType,
    config.basicInfo.isPortable,
  ]);

  useEffect(() => {
    if (!tasks || !tasks.length) setGeneralPercent(undefined);
    else {
      let filteredTasks = tasks.filter(
        (t) => t.status === GTaskEventStatusEnums.Started
      );

      if (filteredTasks.length === 0) setGeneralPercent(undefined);
      else {
        setGeneralPercent(
          filteredTasks.reduce(
            (acc, group) => acc + (group.progress ?? 0) / filteredTasks.length,
            0
          )
        );
      }
    }
  }, [tasks]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        generalPercent,
        handleScheduleProgressiveTaskGroup,
        handleCancelProgressiveTaskGroup,
        handleStopProgressiveTaskGroup,
        handleResumeProgressiveTaskGroup,
        handleClearHistoryTaskGroups,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTaskContext = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTaskContext must be used within a TaskContextProvider");
  }
  return context;
};

export const parseTaskGroup = (
  taskGroup: string
): {
  name: string;
  params: Record<string, string>;
  timestamp: number;
  isRetry: boolean;
  rawName: string;
} => {
  const lastAtIndex = taskGroup.lastIndexOf("@");
  let rawName: string;
  let timestamp: number;

  if (lastAtIndex === -1) {
    rawName = taskGroup;
    timestamp = Date.now();
  } else {
    rawName = taskGroup.substring(0, lastAtIndex);
    timestamp = parseInt(taskGroup.substring(lastAtIndex + 1));
  }

  const [name, paramString] = rawName.split("?");
  const params = paramString ? paramString.split("&") : [];

  return {
    name: name.replace(/^retry-/, ""),
    params:
      params.length === 1
        ? { param: params[0] }
        : Object.fromEntries(
            params.map((param, index) => [`param${index + 1}`, param])
          ),
    isRetry: name.startsWith("retry-"),
    timestamp: timestamp,
    rawName,
  };
};

const isActiveGroup = (t: TaskGroupDesc) =>
  t.status === GTaskEventStatusEnums.Started ||
  t.status === GTaskEventStatusEnums.Stopped;

// Bound the number of task groups kept in memory. The backend only drops a
// group from the active list once the user clears history, so repeatedly
// importing/downloading would otherwise accumulate an unbounded number of
// group objects (and their task descriptors) in React state.
//
// Module scope, not inside the provider: as a closure it was a new function on
// every render, which made it an unstable dependency for the effects and
// callbacks that call it.
const MAX_RETAINED_GROUPS = 30;
const capGroups = (groups: TaskGroupDesc[]): TaskGroupDesc[] => {
  if (groups.length <= MAX_RETAINED_GROUPS) return groups;
  const active = groups.filter(isActiveGroup);
  const inactive = groups
    .filter((g) => !isActiveGroup(g))
    .sort(
      (a, b) =>
        parseTaskGroup(b.taskGroup).timestamp -
        parseTaskGroup(a.taskGroup).timestamp
    );
  const keepInactive = inactive.slice(
    0,
    Math.max(0, MAX_RETAINED_GROUPS - active.length)
  );
  return [...active, ...keepInactive];
};

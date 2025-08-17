import { ToastId, useToast as useChakraToast } from "@chakra-ui/react";
import { emit } from "@tauri-apps/api/event";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { OtherResourceType } from "@/enums/resource";
import {
  FailedTaskEventPayload,
  GroupEvent,
  GroupEventPayloadEnums,
  InProgressTaskEventPayload,
  RuntimeGroupDescSnapshot,
  RuntimeStateEnums,
  RuntimeTaskParam,
  StartedTaskEventPayload,
  TaskDesc,
  TaskEvent,
  TaskEventPayloadEnums,
  TaskGroupDesc,
} from "@/models/task";
import { InstanceService } from "@/services/instance";
import { TaskService } from "@/services/task";
import { parseTaskGroup } from "@/utils/task";

interface TaskContextType {
  tasks: TaskGroupDesc[];
  generalPercent: number | undefined; // General progress percentage for all tasks
  handleScheduleProgressiveTaskGroup: (
    taskGroup: string,
    params: RuntimeTaskParam[]
  ) => void;
  handleCancelProgressiveTaskGroup: (taskGroup: string) => void;
  handleResumeProgressiveTaskGroup: (taskGroup: string) => void;
  handleStopProgressiveTaskGroup: (taskGroup: string) => void;
  handleRetryProgressiveTaskGroup: (taskGroup: string) => void;
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
  const { openSharedModal } = useSharedModals();
  const [tasks, setTasks] = useState<TaskGroupDesc[]>([]);
  const [generalPercent, setGeneralPercent] = useState<number>();
  const { t } = useTranslation();
  const loadingToastRef = React.useRef<ToastId | null>(null);

  const updateGroupDesc = useCallback((group: TaskGroupDesc) => {
    group.finishedCount = group.taskDescs.filter(
      (t) => t.status === RuntimeStateEnums.Completed
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
    } else {
      estimatedTotal = knownTotal; // Fallback when no known tasks exist
    }

    group.progress = estimatedTotal ? (knownCurrent * 100) / estimatedTotal : 0;

    group.estimatedTime = undefined;
    group.taskDescs.forEach((t) => {
      if (t.status === RuntimeStateEnums.InProgress && t.estimatedTime) {
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
          case RuntimeStateEnums.Failed:
            return 0;
          case RuntimeStateEnums.InProgress:
            return 1;
          case RuntimeStateEnums.Waiting:
            return 2;
          case RuntimeStateEnums.Completed:
            return 999;
          default:
            return 3;
        }
      };
      return level(a) - level(b);
    });
  }, []);

  const convertGroupSnapshotToDesc = (
    snapshot: RuntimeGroupDescSnapshot
  ): TaskGroupDesc => {
    return {
      taskGroup: snapshot.name,
      taskDescs: Object.entries(snapshot.taskDescMap).map(([id, desc]) => ({
        taskId: parseInt(id),
        status: desc.state.type,
        total: desc.total,
        current: desc.current,
        startAt: desc.startAt,
        createdAt: desc.createdAt,
        filename: desc.filename,
        dest: desc.dest,
        progress: (desc.current * 100) / desc.total,
        reason:
          desc.state.type === RuntimeStateEnums.Failed
            ? desc.state.reason
            : undefined,
      })),
      status: RuntimeStateEnums.Waiting,
      finishedCount: 0,
      progress: 0,
    };
  };

  const handleRetrieveProgressTasks = useCallback(() => {
    TaskService.retrieveProgressiveTaskList().then((response) => {
      if (response.status === "success") {
        console.log("Retrieved progressive tasks:", response.data);
        // info(JSON.stringify(response.data));
        let newTasks = response.data
          .map((snapshot) => {
            let groupDesc = convertGroupSnapshotToDesc(snapshot);
            updateGroupDesc(groupDesc);
            return groupDesc;
          })
          .filter((group) => group.status !== RuntimeStateEnums.Cancelled);
        newTasks.sort((a, b) => {
          let { timestamp: aTime } = parseTaskGroup(a.taskGroup);
          let { timestamp: bTime } = parseTaskGroup(b.taskGroup);
          return bTime - aTime; // Sort by timestamp descending
        });
        setTasks(newTasks);
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  }, [toast, updateGroupDesc]);

  useEffect(() => {
    handleRetrieveProgressTasks();
  }, [handleRetrieveProgressTasks]);

  const handleScheduleProgressiveTaskGroup = useCallback(
    (taskGroup: string, params: RuntimeTaskParam[]) => {
      TaskService.scheduleProgressiveTaskGroup(taskGroup, params).then(
        (response) => {
          if (response.status === "success") {
            console.log("Scheduled progressive tasks:", response.data);
            let groupDesc = convertGroupSnapshotToDesc(response.data);
            updateGroupDesc(groupDesc);
            setTasks((prevTasks) => {
              return [groupDesc, ...prevTasks];
            });
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        }
      );
    },
    [toast, updateGroupDesc]
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

  const handleRetryProgressiveTaskGroup = useCallback(
    (taskGroup: string) => {
      TaskService.retryProgressiveTaskGroup(taskGroup).then((response) => {
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

  useEffect(() => {
    const unlisten = TaskService.onProgressiveTaskUpdate(
      (payload: TaskEvent) => {
        console.log(
          `Received task update: ${payload.id}, status: ${payload.event.status}`
        );
        setTasks((prevTasks) => {
          const group = prevTasks?.find(
            (t) => t.taskGroup === payload.taskGroup
          );

          switch (payload.event.status) {
            case TaskEventPayloadEnums.Started: {
              if (!group) return prevTasks;
              group.taskDescs = group.taskDescs.map((t) => {
                if (t.taskId === payload.id) {
                  t.status = RuntimeStateEnums.InProgress;
                  t.total = (payload.event as StartedTaskEventPayload).total;
                }
                return t;
              });
              updateGroupDesc(group);
              break;
            }

            case TaskEventPayloadEnums.Completed: {
              if (!group) return prevTasks;
              group.taskDescs = group.taskDescs.map((t) => {
                if (t.taskId === payload.id) {
                  t.status = RuntimeStateEnums.Completed;
                  t.current = t.total;
                }
                return t;
              });
              // info(`Task ${payload.id} completed in group ${payload.taskGroup}`);
              updateGroupDesc(group);
              break;
            }

            case TaskEventPayloadEnums.Stopped: {
              if (!group) return prevTasks;
              group.taskDescs = group.taskDescs.map((t) => {
                if (t.taskId === payload.id) {
                  t.status = RuntimeStateEnums.Stopped;
                }
                return t;
              });
              updateGroupDesc(group);
              break;
            }

            case TaskEventPayloadEnums.Cancelled: {
              if (!group) return prevTasks;
              group.taskDescs = group.taskDescs.map((t) => {
                if (t.taskId === payload.id) {
                  t.status = RuntimeStateEnums.Cancelled;
                }
                return t;
              });
              updateGroupDesc(group);
              // info(`Task ${payload.id} cancelled in group ${payload.taskGroup}`);
              break;
            }

            case TaskEventPayloadEnums.InProgress: {
              if (!group) return prevTasks;
              group.taskDescs = group.taskDescs.map((t) => {
                if (t.taskId === payload.id) {
                  t.current = (
                    payload.event as InProgressTaskEventPayload
                  ).current;
                  t.status = RuntimeStateEnums.InProgress;
                  t.estimatedTime = (
                    payload.event as InProgressTaskEventPayload
                  ).estimatedTime;
                  t.speed = (payload.event as InProgressTaskEventPayload).speed;
                }
                return t;
              });
              updateGroupDesc(group);
              // info(
              //   `Task ${payload.id} in progress in group ${payload.taskGroup}`
              // );
              break;
            }

            case TaskEventPayloadEnums.Failed: {
              console.error(
                `Task ${payload.id} failed in group ${payload.taskGroup}: ${
                  (payload.event as FailedTaskEventPayload).reason
                }`
              );
              if (!group) return prevTasks;
              group.taskDescs = group.taskDescs.map((t) => {
                if (t.taskId === payload.id) {
                  t.status = RuntimeStateEnums.Failed;
                  t.reason = (payload.event as FailedTaskEventPayload).reason;
                }
                return t;
              });
              updateGroupDesc(group);
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
  }, [t, toast, updateGroupDesc]);

  useEffect(() => {
    const unlisten = TaskService.onTaskGroupUpdate((payload: GroupEvent) => {
      console.log(`Received task group update: ${payload.event}`);
      setTasks((prevTasks) => {
        const { name, version } = parseTaskGroup(payload.taskGroup);
        let newTasks = prevTasks.map((group) => {
          if (group.taskGroup === payload.taskGroup) {
            switch (payload.event) {
              case GroupEventPayloadEnums.Started:
                group.status = RuntimeStateEnums.InProgress;
                break;

              case GroupEventPayloadEnums.Completed:
                toast({
                  status: "success",
                  title: t(`Services.task.onTaskGroupUpdate.state.Completed`, {
                    param: t(`DownloadTasksPage.task.${name}`, {
                      param: version || "",
                    }),
                  }),
                });
                group.status = RuntimeStateEnums.Completed;
                group.taskDescs.forEach((t) => {
                  if (
                    t.status === RuntimeStateEnums.Waiting ||
                    t.status === RuntimeStateEnums.InProgress
                  ) {
                    t.status = RuntimeStateEnums.Completed;
                    t.current = t.total;
                  }
                });
                switch (name) {
                  case "game-client":
                    getInstanceList(true);
                    break;
                  case "forge-libraries":
                  case "neoforge-libraries":
                    if (version) {
                      let instanceName = getInstanceList()?.find(
                        (i) => i.id === version
                      )?.name;
                      if (loadingToastRef.current) break;
                      loadingToastRef.current = toast({
                        title: t(
                          "Services.instance.finishModLoaderInstall.loading",
                          {
                            instanceName,
                          }
                        ),
                        status: "loading",
                      });
                      InstanceService.finishModLoaderInstall(version).then(
                        (response) => {
                          if (loadingToastRef.current) {
                            closeToast(loadingToastRef.current);
                            loadingToastRef.current = null;
                          }
                          if (response.status === "success") {
                            toast({
                              title: response.message,
                              status: "success",
                            });
                          } else {
                            toast({
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
                    emit(
                      "instance:refresh-resource-list",
                      OtherResourceType.Mod
                    );
                    break;
                  case "resourcepack":
                    emit(
                      "instance:refresh-resource-list",
                      OtherResourceType.ResourcePack
                    );
                    break;
                  case "shader":
                    emit(
                      "instance:refresh-resource-list",
                      OtherResourceType.ShaderPack
                    );
                    break;
                  case "modpack":
                    if (group.taskDescs.length > 0) {
                      openSharedModal("import-modpack", {
                        path: group.taskDescs[0].dest,
                      });
                    }
                    break;
                  default:
                    break;
                }
                break;

              case GroupEventPayloadEnums.Failed:
                toast({
                  status: "error",
                  title: t(`Services.task.onTaskGroupUpdate.state.Failed`, {
                    param: t(`DownloadTasksPage.task.${name}`, {
                      param: version || "",
                    }),
                  }),
                });
                group.status = RuntimeStateEnums.Failed;
                break;

              case GroupEventPayloadEnums.Stopped:
                group.status = RuntimeStateEnums.Stopped;
                break;

              case GroupEventPayloadEnums.Cancelled:
                group.status = RuntimeStateEnums.Cancelled;
                break;

              default:
                break;
            }
          }
          return group;
        });

        return newTasks;
      });
    });
    return () => {
      unlisten();
    };
  }, [closeToast, getInstanceList, t, toast, updateGroupDesc, openSharedModal]);

  useEffect(() => {
    if (!tasks || !tasks.length) setGeneralPercent(undefined);
    else {
      let filteredTasks = tasks.filter(
        (t) => t.status === RuntimeStateEnums.InProgress
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
        handleResumeProgressiveTaskGroup,
        handleStopProgressiveTaskGroup,
        handleRetryProgressiveTaskGroup,
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

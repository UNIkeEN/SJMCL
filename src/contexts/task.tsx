import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/contexts/toast";
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
import { InstanceService } from "@/services/instance";
import { TaskService } from "@/services/task";
import { parseTaskGroup } from "@/utils/task";
import { useGlobalData } from "./global-data";

interface TaskContextType {
  tasks: TaskGroupDesc[];
  generalPercent: number | undefined; // General progress percentage for all tasks
  handleScheduleProgressiveTaskGroup: (
    taskGroup: string,
    params: TaskParam[]
  ) => void;
  handleCancelProgressiveTaskGroup: (taskGroup: string) => void;
  handleResumeProgressiveTaskGroup: (taskGroup: string) => void;
  handleStopProgressiveTaskGroup: (taskGroup: string) => void;
}

export const TaskContext = createContext<TaskContextType | undefined>(
  undefined
);

export const TaskContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const toast = useToast();
  const { getInstanceList } = useGlobalData();
  const [tasks, setTasks] = useState<TaskGroupDesc[]>([]);
  const [generalPercent, setGeneralPercent] = useState<number>();
  const { t } = useTranslation();

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
    } else {
      estimatedTotal = knownTotal; // Fallback when no known tasks exist
    }

    group.progress = estimatedTotal ? (knownCurrent * 100) / estimatedTotal : 0;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetrieveProgressTasks = useCallback(() => {
    TaskService.retrieveProgressiveTaskList().then((response) => {
      if (response.status === "success") {
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
                return [newGroup, ...(prevTasks || [])];
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
              updateGroupInfo(group);
              // info(
              //   `Task ${payload.id} in progress in group ${payload.taskGroup}`
              // );
              break;
            }

            case PTaskEventStatusEnums.Failed: {
              console.error(
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
  }, [t, toast, updateGroupInfo]);

  useEffect(() => {
    const unlisten = TaskService.onTaskGroupUpdate(
      (payload: GTaskEventPayload) => {
        console.log(`Received task group update: ${payload.event.status}`);
        setTasks((prevTasks) => {
          return prevTasks.map((task) => {
            if (task.taskGroup === payload.taskGroup) {
              task.status = payload.event.status;
            }
            return task;
          });
        });

        const { name, version } = parseTaskGroup(payload.taskGroup);

        toast({
          status:
            payload.event.status === GTaskEventStatusEnums.Failed
              ? "error"
              : "success",
          title: t(
            `Services.task.onTaskGroupUpdate.status.${payload.event.status}`,
            {
              param: t(`DownloadTasksPage.task.${name}`, {
                param: version || "",
              }),
            }
          ),
        });

        if (payload.event.status === GTaskEventStatusEnums.Completed) {
          switch (name) {
            case "game-client":
              getInstanceList(true);
              break;
            case "forge-libraries":
            case "neoforge-libraries":
              version &&
                InstanceService.markModLoaderLibraryDownloaded(version);
              break;
            default:
              break;
          }
        }
      }
    );
    return () => {
      unlisten();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateGroupInfo]);

  useEffect(() => {
    if (!tasks || !tasks.length) return;

    let filteredTasks = tasks.filter(
      (t) => t.status === GTaskEventStatusEnums.Started
    );

    setGeneralPercent(
      filteredTasks.reduce(
        (acc, group) => acc + (group.progress ?? 0) / filteredTasks.length,
        0
      )
    );
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

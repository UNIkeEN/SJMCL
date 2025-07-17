import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/contexts/toast";
import {
  CreatedPTaskEventStatus,
  FailedPTaskEventStatus,
  InProgressPTaskEventStatus,
  PTaskEventPayload,
  PTaskEventStatusEnums,
  StartedPTaskEventStatus,
  TaskDesc,
  TaskDescStatusEnums,
  TaskGroupDesc,
  TaskParam,
} from "@/models/task";
import { TaskService } from "@/services/task";
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

  // use ref to cache pending update on tasks
  const pendingTasksRef = useRef<TaskGroupDesc[] | null>(null);
  const tasksChangedRef = useRef<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (pendingTasksRef.current && tasksChangedRef.current) {
        setTasks([...pendingTasksRef.current]);
        tasksChangedRef.current = false;
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const updateGroupInfo = useCallback((group: TaskGroupDesc) => {
    group.current = group.taskDescs.reduce((acc, t) => acc + t.current, 0);
    group.total = group.taskDescs.reduce((acc, t) => acc + t.total, 0);
    group.progress = group.total > 0 ? (group.current * 100) / group.total : 0;
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

    if (
      group.taskDescs.every((t) => t.status === TaskDescStatusEnums.Completed)
    ) {
      group.status = TaskDescStatusEnums.Completed;

      let groupInfo = group.taskGroup.split("@")[0].split(":");
      if (groupInfo.length > 1 && groupInfo[0] === "game-client") {
        getInstanceList(true);
      }
    } else if (
      group.taskDescs.some((t) => t.status === TaskDescStatusEnums.Stopped)
    ) {
      group.status = TaskDescStatusEnums.Stopped;
    } else if (
      group.taskDescs.some((t) => t.status === TaskDescStatusEnums.Failed)
    ) {
      group.status = TaskDescStatusEnums.Failed;
      group.reason = group.taskDescs
        .filter((t) => t.status === TaskDescStatusEnums.Failed)
        .map((t) => t.reason)
        .filter((r) => r)[0];
    } else if (
      group.taskDescs.some((t) => t.status === TaskDescStatusEnums.Cancelled)
    ) {
      group.status = TaskDescStatusEnums.Cancelled;
    } else if (
      group.taskDescs.some((t) => t.status === TaskDescStatusEnums.InProgress)
    ) {
      group.status = TaskDescStatusEnums.InProgress;
    } else {
      group.status = TaskDescStatusEnums.Waiting;
    }

    tasksChangedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetrieveProgressTasks = useCallback(() => {
    TaskService.retrieveProgressiveTaskList().then((response) => {
      if (response.status === "success") {
        // info(JSON.stringify(response.data));
        let tasks = response.data
          .map((taskGroup) => {
            updateGroupInfo(taskGroup);
            return taskGroup;
          })
          .filter(
            (taskGroup) => taskGroup.status !== TaskDescStatusEnums.Cancelled
          );
        tasks.sort((a, b) => {
          let aTime = parseInt(a.taskGroup.split("@").pop() || "0");
          let bTime = parseInt(b.taskGroup.split("@").pop() || "0");
          return bTime - aTime; // Sort by timestamp descending
        });
        setTasks(tasks);
        pendingTasksRef.current = tasks;
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
        } else {
          setTasks((prevTasks) =>
            prevTasks?.map((t) => {
              if (t.taskGroup === taskGroup) {
                t.status = TaskDescStatusEnums.Cancelled;
              }
              return t;
            })
          );
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

        const currentTasks = pendingTasksRef.current;

        if (payload.event.status === PTaskEventStatusEnums.Created) {
          let group = currentTasks?.find(
            (t) => t.taskGroup === payload.taskGroup
          );

          if (group) {
            if (group.taskDescs.some((t) => t.taskId === payload.id)) {
              // info(
              //   `Task ${payload.id} already exists in group ${payload.taskGroup}`
              // );
            } else if (
              group.taskDescs.some(
                (t) =>
                  t.payload.dest ===
                  (payload.event as CreatedPTaskEventStatus).desc.payload.dest
              )
            ) {
              // It' a retrial task emitted from the backend
              group.taskDescs = group.taskDescs.map((t) => {
                if (
                  t.payload.dest ===
                  (payload.event as CreatedPTaskEventStatus).desc.payload.dest
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
              taskGroup: payload.taskGroup,
              taskDescs: [payload.event.desc],
            };
            updateGroupInfo(newGroup);

            pendingTasksRef.current = [newGroup, ...(currentTasks || [])];
          }
        } else if (payload.event.status === PTaskEventStatusEnums.Started) {
          let group = currentTasks?.find(
            (t) => t.taskGroup === payload.taskGroup
          );
          if (!group) return;

          group.status = TaskDescStatusEnums.InProgress;
          group.taskDescs = group.taskDescs.map((t) => {
            if (t.taskId === payload.id) {
              t.status = TaskDescStatusEnums.InProgress;
              t.total = (payload.event as StartedPTaskEventStatus).total;
            }
            return t;
          });
          updateGroupInfo(group);
        } else if (payload.event.status === PTaskEventStatusEnums.Completed) {
          let group = currentTasks?.find(
            (t) => t.taskGroup === payload.taskGroup
          );
          if (!group) return;

          group.taskDescs = group.taskDescs.map((t) => {
            if (t.taskId === payload.id) {
              t.status = TaskDescStatusEnums.Completed;
              t.current = t.total;
            }
            return t;
          });
          // info(`Task ${payload.id} completed in group ${payload.taskGroup}`);

          updateGroupInfo(group);
          tasksChangedRef.current = true;
        } else if (payload.event.status === PTaskEventStatusEnums.Stopped) {
          let group = currentTasks?.find(
            (t) => t.taskGroup === payload.taskGroup
          );
          if (!group) return;

          group.taskDescs = group.taskDescs.map((t) => {
            if (t.taskId === payload.id) {
              t.status = TaskDescStatusEnums.Stopped;
            }
            return t;
          });
          updateGroupInfo(group);
        } else if (payload.event.status === PTaskEventStatusEnums.Cancelled) {
          let group = currentTasks?.find(
            (t) => t.taskGroup === payload.taskGroup
          );
          if (!group) return;

          group.taskDescs = group.taskDescs.map((t) => {
            if (t.taskId === payload.id) {
              t.status = TaskDescStatusEnums.Cancelled;
            }
            return t;
          });
          updateGroupInfo(group);
          // info(`Task ${payload.id} cancelled in group ${payload.taskGroup}`);
        } else if (payload.event.status === PTaskEventStatusEnums.InProgress) {
          let group = currentTasks?.find(
            (t) => t.taskGroup === payload.taskGroup
          );
          if (!group) return;
          group.taskDescs = group.taskDescs.map((t) => {
            if (t.taskId === payload.id) {
              t.current = (payload.event as InProgressPTaskEventStatus).current;
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
        } else if (payload.event.status === PTaskEventStatusEnums.Failed) {
          console.error(
            `Task ${payload.id} failed in group ${payload.taskGroup}: ${
              (payload.event as FailedPTaskEventStatus).reason
            }`
          );
          toast({
            title: t(`Services.task.onProgressiveTaskUpdate.error.title`, {
              param: payload.id,
            }),
            description: (payload.event as FailedPTaskEventStatus).reason,
            status: "error",
          });
          let group = currentTasks?.find(
            (t) => t.taskGroup === payload.taskGroup
          );
          if (!group) return;
          group.taskDescs = group.taskDescs.map((t) => {
            if (t.taskId === payload.id) {
              t.status = TaskDescStatusEnums.Failed;
              t.reason = (payload.event as FailedPTaskEventStatus).reason;
            }
            return t;
          });
          updateGroupInfo(group);
          // info(`Task ${payload.id} failed in group ${payload.taskGroup}`);
        }
      }
    );

    return () => {
      unlisten();
    };
  }, [t, toast, updateGroupInfo]);

  useEffect(() => {
    if (!tasks || !tasks.length) return;
    const generalCurrent = tasks.reduce(
      (acc, task) =>
        acc +
        (task?.status === TaskDescStatusEnums.InProgress
          ? (task?.current ?? 0)
          : 0) /
          tasks.length,
      0
    );
    const generalTotal = tasks.reduce(
      (acc, task) =>
        acc +
        (task?.status === TaskDescStatusEnums.InProgress
          ? (task?.total ?? 0)
          : 0) /
          tasks.length,
      0
    );

    if (generalTotal) {
      setGeneralPercent((generalCurrent / generalTotal) * 100);
    } else {
      setGeneralPercent(0);
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

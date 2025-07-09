import { info } from "@tauri-apps/plugin-log";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useToast } from "@/contexts/toast";
import {
  FailedPTaskEventStatus,
  InProgressPTaskEventStatus,
  PTaskEventPayload,
  PTaskEventStatusEnums,
  TaskDescStatusEnums,
  TaskGroupDesc,
  TaskParam,
} from "@/models/task";
import { TaskService } from "@/services/task";

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
  const [tasks, setTasks] = useState<TaskGroupDesc[]>([]);
  const [generalPercent, setGeneralPercent] = useState<number>();

  const updateGroupInfo = (group: TaskGroupDesc) => {
    group.current = group.taskDescs.reduce((acc, t) => acc + t.current, 0);
    group.total = group.taskDescs.reduce((acc, t) => acc + t.total, 0);
    group.progress = group.total > 0 ? (group.current * 100) / group.total : 0;
    group.estimatedTime = undefined;
    group.taskDescs.forEach((t) => {
      if (t.estimatedTime) {
        if (
          !group.estimatedTime ||
          group.estimatedTime.secs < t.estimatedTime.secs
        ) {
          group.estimatedTime = t.estimatedTime;
        }
      }
      t.progress = t.total ? (t.current * 100) / t.total : 0;
    });

    if (
      group.taskDescs.every((t) => t.status === TaskDescStatusEnums.Completed)
    ) {
      group.status = TaskDescStatusEnums.Completed;
    } else if (
      group.taskDescs.some((t) => t.status === TaskDescStatusEnums.Failed)
    ) {
      group.status = TaskDescStatusEnums.Failed;
    } else if (
      group.taskDescs.some((t) => t.status === TaskDescStatusEnums.Cancelled)
    ) {
      group.status = TaskDescStatusEnums.Cancelled;
    } else if (
      group.taskDescs.some((t) => t.status === TaskDescStatusEnums.Stopped)
    ) {
      group.status = TaskDescStatusEnums.Stopped;
    } else if (
      group.taskDescs.some((t) => t.status === TaskDescStatusEnums.InProgress)
    ) {
      group.status = TaskDescStatusEnums.InProgress;
    }
  };
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
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  }, [toast]);

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
        info(
          `Received task update: ${payload.id}, status: ${payload.event.status}`
        );
        setTasks((prevTasks) => {
          if (payload.event.status === PTaskEventStatusEnums.Created) {
            let group = prevTasks?.find(
              (t) => t.taskGroup === payload.taskGroup
            );

            if (group) {
              if (group.taskDescs.some((t) => t.taskId === payload.id)) {
                // info(
                //   `Task ${payload.id} already exists in group ${payload.taskGroup}`
                // );
                return prevTasks;
              } else {
                group.taskDescs.unshift(payload.event.desc);
                // info(`Added task ${payload.id} to group ${payload.taskGroup}`);
                updateGroupInfo(group);
                return [...prevTasks];
              }
            }
            // info(`Creating new task group ${payload.taskGroup}`);
            // Create a new task group if it doesn't exist
            let newGroup: TaskGroupDesc = {
              taskGroup: payload.taskGroup,
              taskDescs: [payload.event.desc],
            };
            updateGroupInfo(newGroup);

            return [newGroup, ...(prevTasks || [])];
          } else if (payload.event.status === PTaskEventStatusEnums.Started) {
            let group = prevTasks?.find(
              (t) => t.taskGroup === payload.taskGroup
            );
            if (!group) return prevTasks;

            group.status = TaskDescStatusEnums.InProgress;
            return [...prevTasks];
          } else if (payload.event.status === PTaskEventStatusEnums.Completed) {
            let group = prevTasks?.find(
              (t) => t.taskGroup === payload.taskGroup
            );
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

            if (
              group.taskDescs.every(
                (t) => t.status === TaskDescStatusEnums.Completed
              )
            ) {
              // info(`All tasks completed in group ${payload.taskGroup}`);
              group.status = TaskDescStatusEnums.Completed;
            }
            return [...prevTasks];
          } else if (payload.event.status === PTaskEventStatusEnums.Stopped) {
            let group = prevTasks?.find(
              (t) => t.taskGroup === payload.taskGroup
            );
            if (!group) return prevTasks;

            group.taskDescs = group.taskDescs.map((t) => {
              if (t.taskId === payload.id) {
                t.status = TaskDescStatusEnums.Stopped;
              }
              return t;
            });
            group.status = TaskDescStatusEnums.Stopped;
            // info(`Task ${payload.id} stopped in group ${payload.taskGroup}`);
            return [...prevTasks];
          } else if (payload.event.status === PTaskEventStatusEnums.Cancelled) {
            let group = prevTasks?.find(
              (t) => t.taskGroup === payload.taskGroup
            );
            if (!group) return prevTasks;

            group.taskDescs = group.taskDescs.map((t) => {
              if (t.taskId === payload.id) {
                t.status = TaskDescStatusEnums.Cancelled;
              }
              return t;
            });
            group.status = TaskDescStatusEnums.Cancelled;
            // info(`Task ${payload.id} cancelled in group ${payload.taskGroup}`);
            return [...prevTasks];
          } else if (
            payload.event.status === PTaskEventStatusEnums.InProgress
          ) {
            let group = prevTasks?.find(
              (t) => t.taskGroup === payload.taskGroup
            );
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
            group.status = TaskDescStatusEnums.InProgress;
            updateGroupInfo(group);

            // info(
            //   `Task ${payload.id} in progress in group ${payload.taskGroup}`
            // );
            return [...prevTasks];
          } else if (payload.event.status === PTaskEventStatusEnums.Failed) {
            let group = prevTasks?.find(
              (t) => t.taskGroup === payload.taskGroup
            );
            if (!group) return prevTasks;

            group.taskDescs = group.taskDescs.map((t) => {
              if (t.taskId === payload.id) {
                t.reason = (payload.event as FailedPTaskEventStatus).reason;
                t.status = TaskDescStatusEnums.Failed;
              }
              return t;
            });
            group.status = TaskDescStatusEnums.Failed;
            // info(`Task ${payload.id} failed in group ${payload.taskGroup}`);
            return [...prevTasks];
          } else {
            return prevTasks;
          }
        });
      }
    );

    return () => {
      unlisten();
    };
  }, []);

  useEffect(() => {
    if (!tasks) return;
    const generalCurrent = tasks.reduce(
      (acc, task) =>
        acc +
        (task?.status === TaskDescStatusEnums.InProgress
          ? (task?.current ?? 0)
          : 0),
      0
    );
    const generalTotal = tasks.reduce(
      (acc, task) =>
        acc +
        (task?.status === TaskDescStatusEnums.InProgress
          ? (task?.total ?? 0)
          : 0),
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

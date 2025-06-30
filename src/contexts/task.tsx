import { info } from "@tauri-apps/plugin-log";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/contexts/toast";
import { useGetState } from "@/hooks/get-state";
import {
  FailedPTaskEventStatus,
  InProgressPTaskEventStatus,
  PTaskEventPayload,
  PTaskEventStatusEnums,
  TaskDesc,
  TaskDescStatusEnums,
  TaskParam,
} from "@/models/task";
import { TaskService } from "@/services/task";

interface TaskContextType {
  getTasks: (sync?: boolean) => TaskDesc[] | undefined;
  handleScheduleProgressiveTaskGroup: (
    taskGroup: string,
    params: TaskParam[]
  ) => void;
  handleCancelProgressiveTask: (taskId: number) => void;
  handleResumeProgressiveTask: (taskId: number) => void;
  handleStopProgressiveTask: (taskId: number) => void;
  generalPercent: number | undefined; // General progress percentage for all tasks
}

export const TaskContext = createContext<TaskContextType | undefined>(
  undefined
);

export const TaskContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const toast = useToast();
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<TaskDesc[]>();
  const [generalPercent, setGeneralPercent] = useState<number>();

  const handleRetrieveProgressTasks = useCallback(() => {
    TaskService.retrieveProgressiveTaskList().then((response) => {
      if (response.status === "success") {
        info(JSON.stringify(response.data));
        setTasks(response.data);
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  }, [toast]);

  const getTasks = useGetState(tasks, handleRetrieveProgressTasks);

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

  const handleCancelProgressiveTask = useCallback(
    (taskId: number) => {
      TaskService.cancelProgressiveTask(taskId).then((response) => {
        if (response.status !== "success") {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        } else {
          setTasks((prevTasks) =>
            prevTasks?.map((t) => {
              if (t.taskId === taskId) {
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

  const handleResumeProgressiveTask = useCallback(
    (taskId: number) => {
      TaskService.resumeProgressiveTask(taskId).then((response) => {
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

  const handleStopProgressiveTask = useCallback(
    (taskId: number) => {
      TaskService.stopProgressiveTask(taskId).then((response) => {
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
        console.log(payload);
        setTasks((prevTasks) => {
          if (payload.event.status === PTaskEventStatusEnums.Created) {
            if (
              prevTasks?.some(
                (t) =>
                  t.taskGroup === payload.taskGroup && t.taskId === payload.id
              )
            ) {
              return prevTasks;
            }
            return [payload.event.desc, ...(prevTasks || [])];
          } else if (payload.event.status === PTaskEventStatusEnums.Completed) {
            return (
              prevTasks?.map((t) => {
                if (t.taskId === payload.id) {
                  t.current = t.total;
                  t.status = TaskDescStatusEnums.Completed;
                }
                return t;
              }) || []
            );
          } else if (payload.event.status === PTaskEventStatusEnums.Stopped) {
            return (
              prevTasks?.map((t) => {
                if (t.taskId === payload.id) {
                  t.status = TaskDescStatusEnums.Stopped;
                }
                return t;
              }) || []
            );
          } else if (payload.event.status === PTaskEventStatusEnums.Cancelled) {
            return (
              prevTasks?.map((t) => {
                if (t.taskId === payload.id) {
                  t.status = TaskDescStatusEnums.Cancelled;
                }
                return t;
              }) || []
            );
          } else if (
            payload.event.status === PTaskEventStatusEnums.InProgress
          ) {
            return (
              prevTasks?.map((t) => {
                if (t.taskId === payload.id) {
                  t.current = (
                    payload.event as InProgressPTaskEventStatus
                  ).current;
                  t.status = TaskDescStatusEnums.InProgress;
                  t.estimatedTime = (
                    payload.event as InProgressPTaskEventStatus
                  ).estimatedTime;
                }
                return t;
              }) || []
            );
          } else if (payload.event.status === PTaskEventStatusEnums.Failed) {
            return (
              prevTasks?.map((t) => {
                if (t.taskId === payload.id) {
                  t.reason = (payload.event as FailedPTaskEventStatus).reason;
                  t.status = TaskDescStatusEnums.Failed;
                }
                return t;
              }) || []
            );
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
        (task.status === TaskDescStatusEnums.InProgress ? task.current : 0),
      0
    );
    const generalTotal = tasks.reduce(
      (acc, task) =>
        acc + (task.status === TaskDescStatusEnums.InProgress ? task.total : 0),
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
        getTasks,
        handleScheduleProgressiveTaskGroup,
        handleCancelProgressiveTask,
        handleResumeProgressiveTask,
        handleStopProgressiveTask,
        generalPercent,
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

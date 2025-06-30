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
  FailedPTaskEventPayload,
  InProgressPTaskEventPayload,
  PTaskEvent,
  PTaskEventPayloadStateEnums,
  TaskDesc,
  TaskDescStateEnums,
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
            setTasks((prevTasks) =>
              prevTasks !== undefined
                ? [...prevTasks, ...response.data.taskDescs]
                : response.data.taskDescs
            );
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
    const unlisten = TaskService.onProgressiveTaskUpdate((task: PTaskEvent) => {
      setTasks((prevTasks) => {
        if (
          task.payload.event.state === PTaskEventPayloadStateEnums.Completed
        ) {
          return (
            prevTasks?.map((t) => {
              if (t.taskId === task.id) {
                t.current = t.total;
                t.state = TaskDescStateEnums.Completed;
              }
              return t;
            }) || []
          );
        } else if (
          task.payload.event.state === PTaskEventPayloadStateEnums.Stopped
        ) {
          return (
            prevTasks?.map((t) => {
              if (t.taskId === task.id) {
                t.state = TaskDescStateEnums.Stopped;
              }
              return t;
            }) || []
          );
        } else if (
          task.payload.event.state === PTaskEventPayloadStateEnums.Cancelled
        ) {
          return (
            prevTasks?.map((t) => {
              if (t.taskId === task.id) {
                t.state = TaskDescStateEnums.Cancelled;
              }
              return t;
            }) || []
          );
        } else if (
          task.payload.event.state === PTaskEventPayloadStateEnums.InProgress
        ) {
          return (
            prevTasks?.map((t) => {
              if (t.taskId === task.id) {
                t.current = (
                  task.payload.event as InProgressPTaskEventPayload
                ).current;
                t.state = TaskDescStateEnums.InProgress;
              }
              return t;
            }) || []
          );
        } else if (
          task.payload.event.state === PTaskEventPayloadStateEnums.Failed
        ) {
          return (
            prevTasks?.map((t) => {
              if (t.taskId === task.id) {
                t.reason = (
                  task.payload.event as FailedPTaskEventPayload
                ).reason;
              }
              return t;
            }) || []
          );
        } else {
          return prevTasks;
        }
      });
    });

    return () => {
      unlisten();
    };
  }, []);

  return (
    <TaskContext.Provider
      value={{
        getTasks,
        handleScheduleProgressiveTaskGroup,
        handleCancelProgressiveTask,
        handleResumeProgressiveTask,
        handleStopProgressiveTask,
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

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
  FailedPTaskEventState,
  InProgressPTaskEventState,
  PTaskEventPayload,
  PTaskEventStateEnums,
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
                ? [...prevTasks, ...(response.data.taskDescs || [])]
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
    const unlisten = TaskService.onProgressiveTaskUpdate(
      (payload: PTaskEventPayload) => {
        console.log(payload);
        setTasks((prevTasks) => {
          if (payload.event.state === PTaskEventStateEnums.Created) {
            if (
              prevTasks?.some(
                (t) =>
                  t.taskGroup === payload.taskGroup && t.taskId === payload.id
              )
            ) {
              console.log(
                `Task with ID ${payload.id} already exists, skipping creation.`
              );
              return prevTasks;
            }
            return [...(prevTasks || []), payload.event.desc];
          } else if (payload.event.state === PTaskEventStateEnums.Completed) {
            return (
              prevTasks?.map((t) => {
                if (t.taskId === payload.id) {
                  t.current = t.total;
                  t.state = TaskDescStateEnums.Completed;
                }
                return t;
              }) || []
            );
          } else if (payload.event.state === PTaskEventStateEnums.Stopped) {
            return (
              prevTasks?.map((t) => {
                if (t.taskId === payload.id) {
                  t.state = TaskDescStateEnums.Stopped;
                }
                return t;
              }) || []
            );
          } else if (payload.event.state === PTaskEventStateEnums.Cancelled) {
            return (
              prevTasks?.map((t) => {
                if (t.taskId === payload.id) {
                  t.state = TaskDescStateEnums.Cancelled;
                }
                return t;
              }) || []
            );
          } else if (payload.event.state === PTaskEventStateEnums.InProgress) {
            return (
              prevTasks?.map((t) => {
                if (t.taskId === payload.id) {
                  t.current = (
                    payload.event as InProgressPTaskEventState
                  ).current;
                  t.state = TaskDescStateEnums.InProgress;
                }
                return t;
              }) || []
            );
          } else if (payload.event.state === PTaskEventStateEnums.Failed) {
            return (
              prevTasks?.map((t) => {
                if (t.taskId === payload.id) {
                  t.reason = (payload.event as FailedPTaskEventState).reason;
                }
                return t;
              }) || []
            );
          } else {
            console.warn(`Unhandled task event state: ${payload.event.state}`);
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
    console.log("Tasks updated:", tasks);
  }, [tasks]);

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

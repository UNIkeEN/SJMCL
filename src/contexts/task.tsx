import { ToastId, useToast as useChakraToast } from "@chakra-ui/react";
import { emit } from "@tauri-apps/api/event";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { OtherResourceType } from "@/enums/resource";
import {
  DownloadFinishKind,
  DownloadFinishedEvent,
  DownloadGroup,
  DownloadGroupState,
  DownloadGroupStats,
  DownloadGroupSummary,
  DownloadTask,
  DownloadTaskError,
  DownloadTaskState,
  SubmitDownloadTask,
} from "@/models/download";
import { ConfigService } from "@/services/config";
import { DownloadService } from "@/services/download";
import {
  EXTENSION_REFRESH_EVENT,
  ExtensionService,
} from "@/services/extension";
import { InstanceService } from "@/services/instance";
import { RESOURCE_REFRESH_EVENT } from "@/services/resource";

interface TaskContextType {
  tasks: DownloadGroup[];
  generalPercent: number | undefined;
  handleSubmitDownloadGroup: (
    name: string,
    tasks: SubmitDownloadTask[]
  ) => void;
  handleCancelDownloadGroup: (groupId: string) => void;
  handlePauseDownloadGroup: (groupId: string) => void;
  handleResumeDownloadGroup: (groupId: string) => void;
  handleRetryDownloadGroup: (groupId: string) => void;
  handleClearDownloadHistory: () => void;
}

export const TaskContext = createContext<TaskContextType | undefined>(
  undefined
);

const taskErrorText = (error: DownloadTaskError | null): string | undefined => {
  if (!error) return undefined;
  if ("Http" in error) return `HTTP ${error.Http}`;
  if ("Checksum" in error) {
    return `Checksum mismatch: ${error.Checksum.actual}`;
  }
  return Object.values(error)[0];
};

const deriveStats = (tasks: DownloadTask[]): DownloadGroupStats => ({
  total: tasks.length,
  done: tasks.filter((task) => task.state === DownloadTaskState.Done).length,
  failed: tasks.filter((task) => task.state === DownloadTaskState.Failed)
    .length,
  cancelled: tasks.filter((task) => task.state === DownloadTaskState.Cancelled)
    .length,
  downloading: tasks.filter(
    (task) =>
      task.state === DownloadTaskState.Downloading ||
      task.state === DownloadTaskState.Verifying
  ).length,
  pending: tasks.filter(
    (task) =>
      task.state === DownloadTaskState.Pending ||
      task.state === DownloadTaskState.Paused
  ).length,
  verified: tasks.filter((task) => task.verified).length,
});

const taskOrder = (state: DownloadTaskState): number => {
  switch (state) {
    case DownloadTaskState.Failed:
      return 0;
    case DownloadTaskState.Downloading:
    case DownloadTaskState.Verifying:
      return 1;
    case DownloadTaskState.Pending:
      return 2;
    case DownloadTaskState.Done:
      return 4;
    default:
      return 3;
  }
};

const deriveGroup = (
  summary: DownloadGroupSummary,
  tasks: DownloadTask[]
): DownloadGroup => {
  const derivedTasks = tasks
    .map((task) => ({
      ...task,
      progress: task.total ? (task.received * 100) / task.total : 0,
    }))
    .sort((left, right) => taskOrder(left.state) - taskOrder(right.state));
  const known = derivedTasks.filter((task) => task.total > 0);
  const knownTotal = known.reduce((total, task) => total + task.total, 0);
  const knownReceived = known.reduce((total, task) => total + task.received, 0);
  const estimatedTotal = known.length
    ? knownTotal +
      (derivedTasks.length - known.length) * (knownTotal / known.length)
    : 0;
  const progress =
    summary.finish === DownloadFinishKind.Completed
      ? 100
      : estimatedTotal
        ? (knownReceived * 100) / estimatedTotal
        : 0;
  const etaSecs = derivedTasks
    .filter(
      (task) =>
        task.state === DownloadTaskState.Downloading && task.etaSecs != null
    )
    .reduce<
      number | undefined
    >((longest, task) => Math.max(longest ?? 0, task.etaSecs ?? 0), undefined);

  return {
    ...summary,
    tasks: derivedTasks,
    stats: deriveStats(derivedTasks),
    progress,
    etaSecs,
    error: taskErrorText(
      derivedTasks.find((task) => task.error)?.error ?? null
    ),
  };
};

const mergeRuntimeProgress = (
  tasks: DownloadTask[],
  previous?: DownloadGroup
): DownloadTask[] =>
  tasks.map((task) => {
    const oldTask = previous?.tasks.find((item) => item.id === task.id);
    return {
      ...oldTask,
      ...task,
      speedBps: oldTask?.speedBps,
      etaSecs: oldTask?.etaSecs,
    };
  });

export const TaskContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const toast = useToast();
  const { close: closeToast } = useChakraToast();
  const { getInstanceList } = useGlobalData();
  const { config, getJavaInfos } = useLauncherConfig();
  const { openSharedModal, openGenericConfirmDialog } = useSharedModals();
  const [tasks, setTasks] = useState<DownloadGroup[]>([]);
  const tasksRef = useRef<DownloadGroup[]>([]);
  const { t } = useTranslation();
  const refreshSequence = useRef(0);
  const modLoaderLoadingToastRef = useRef<ToastId | null>(null);
  const optifineLoadingToastRef = useRef<ToastId | null>(null);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const showCommandError = useCallback(
    (error: unknown) => {
      toast({
        title: t("Services.task.submitDownloadGroup.error"),
        description: String(error),
        status: "error",
      });
    },
    [t, toast]
  );

  const loadGroup = useCallback(
    async (
      summary: DownloadGroupSummary,
      previous?: DownloadGroup
    ): Promise<DownloadGroup> => {
      const groupTasks = await DownloadService.listTasks(summary.id);
      return deriveGroup(summary, mergeRuntimeProgress(groupTasks, previous));
    },
    []
  );

  const refreshDownloadGroups = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const summaries = await DownloadService.snapshot();
      const previous = tasksRef.current;
      const groups = await Promise.all(
        summaries.map((summary) =>
          loadGroup(
            summary,
            previous.find((group) => group.id === summary.id)
          )
        )
      );
      if (sequence !== refreshSequence.current) return;
      groups.sort(
        (left, right) =>
          Number(right.id.replace(/^\D+/, "")) -
          Number(left.id.replace(/^\D+/, ""))
      );
      setTasks(groups);
    } catch (error) {
      showCommandError(error);
    }
  }, [loadGroup, showCommandError]);

  useEffect(() => {
    void refreshDownloadGroups();
  }, [refreshDownloadGroups]);

  const handleSubmitDownloadGroup = useCallback(
    (name: string, groupTasks: SubmitDownloadTask[]) => {
      DownloadService.submitGroup({
        name,
        tasks: groupTasks,
        autoResume: true,
      })
        .then(() => refreshDownloadGroups())
        .catch(showCommandError);
    },
    [refreshDownloadGroups, showCommandError]
  );

  const runGroupCommand = useCallback(
    (command: (groupId: string) => Promise<void>, groupId: string) => {
      command(groupId).catch(showCommandError);
    },
    [showCommandError]
  );

  const handleCancelDownloadGroup = useCallback(
    (groupId: string) => runGroupCommand(DownloadService.cancelGroup, groupId),
    [runGroupCommand]
  );
  const handlePauseDownloadGroup = useCallback(
    (groupId: string) => runGroupCommand(DownloadService.pauseGroup, groupId),
    [runGroupCommand]
  );
  const handleResumeDownloadGroup = useCallback(
    (groupId: string) => runGroupCommand(DownloadService.resumeGroup, groupId),
    [runGroupCommand]
  );
  const handleRetryDownloadGroup = useCallback(
    (groupId: string) => runGroupCommand(DownloadService.retryGroup, groupId),
    [runGroupCommand]
  );

  const handleClearDownloadHistory = useCallback(() => {
    const finished = tasks.filter(
      (group) => group.state === DownloadGroupState.Finished
    );
    Promise.all(finished.map((group) => DownloadService.removeGroup(group.id)))
      .then(() => {
        setTasks((current) =>
          current.filter((group) => group.state !== DownloadGroupState.Finished)
        );
      })
      .catch(showCommandError);
  }, [showCommandError, tasks]);

  const handleCompletedGroup = useCallback(
    (group: DownloadGroup) => {
      const { name, params } = parseTaskGroup(group.name);
      switch (name) {
        case "game-client":
        case "change-mod-loader":
        case "change-optifine":
          getInstanceList(true);
          break;
        case "game-client-w-java":
          getInstanceList(true);
          getJavaInfos(true);
          break;
        case "forge-libraries":
        case "cleanroom-libraries":
        case "neoforge-libraries": {
          const instanceId = params.param || params.param1;
          if (!instanceId || modLoaderLoadingToastRef.current) break;
          const instanceName = getInstanceList()?.find(
            (instance) => instance.id === instanceId
          )?.name;
          modLoaderLoadingToastRef.current = toast({
            title: t("Services.instance.finishModLoaderInstall.loading", {
              instanceName,
            }),
            status: "loading",
          });
          InstanceService.finishModLoaderInstall(instanceId).then(
            (response) => {
              if (modLoaderLoadingToastRef.current) {
                closeToast(modLoaderLoadingToastRef.current);
                modLoaderLoadingToastRef.current = null;
              }
              if (response.status === "success") {
                getInstanceList(true);
                toast({ title: response.message, status: "success" });
              } else {
                toast({
                  title: response.message,
                  description: response.details,
                  status: "error",
                });
              }
            }
          );
          break;
        }
        case "optifine-libraries": {
          const instanceId = params.param || params.param1;
          if (!instanceId || optifineLoadingToastRef.current) break;
          const instanceName = getInstanceList()?.find(
            (instance) => instance.id === instanceId
          )?.name;
          optifineLoadingToastRef.current = toast({
            title: t("Services.instance.finishOptiFineLoaderInstall.loading", {
              instanceName,
            }),
            status: "loading",
          });
          InstanceService.finishOptiFineLoaderInstall(instanceId).then(
            (response) => {
              if (optifineLoadingToastRef.current) {
                closeToast(optifineLoadingToastRef.current);
                optifineLoadingToastRef.current = null;
              }
              if (response.status === "success") {
                getInstanceList(true);
                toast({ title: response.message, status: "success" });
              } else {
                toast({
                  title: response.message,
                  description: response.details,
                  status: "error",
                });
              }
            }
          );
          break;
        }
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
        case "modpack":
          if (group.tasks[0]) {
            openSharedModal("import-modpack", { path: group.tasks[0].dest });
          }
          break;
        case "launcher-update":
          if (group.tasks[0]) {
            const task = group.tasks[0];
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
                ConfigService.installLauncherUpdate(task.name, true).then(
                  (response) => {
                    if (response.status !== "success") {
                      toast({
                        title: response.message,
                        description: response.details,
                        status: "error",
                      });
                    }
                  }
                );
              },
              onCancelCallback: () => {
                ConfigService.installLauncherUpdate(task.name, false).then(
                  (response) => {
                    if (response.status !== "success") {
                      toast({
                        title: response.message,
                        description: response.details,
                        status: "error",
                      });
                    }
                  }
                );
              },
            });
          }
          break;
        case "extension-update": {
          const task = group.tasks[0];
          const expectedIdentifier = params.param1;
          const newVersion = params.param2 || "";
          if (task && expectedIdentifier) {
            openGenericConfirmDialog({
              title: t("ExtensionUpdateConfirmDialog.title"),
              body: t("ExtensionUpdateConfirmDialog.body", {
                identifier: expectedIdentifier,
                version: newVersion,
                src: task.spec.url,
              }),
              onOKCallback: () => {
                ExtensionService.addExtension(
                  task.dest,
                  expectedIdentifier
                ).then((response) => {
                  if (response.status === "success") {
                    toast({ title: response.message, status: "success" });
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
      }
    },
    [
      closeToast,
      config.basicInfo.isPortable,
      config.basicInfo.osType,
      getInstanceList,
      getJavaInfos,
      openGenericConfirmDialog,
      openSharedModal,
      t,
      toast,
    ]
  );

  useEffect(() => {
    const stopTick = DownloadService.onTick((updates) => {
      setTasks((groups) =>
        groups.map((group) => {
          const relevant = updates.filter(
            (progress) => progress.groupId === group.id
          );
          if (!relevant.length) return group;
          const nextTasks = group.tasks.map((task) => {
            const progress = relevant.find((item) => item.taskId === task.id);
            return progress
              ? {
                  ...task,
                  state: progress.state,
                  received: progress.received,
                  total: progress.total,
                  speedBps: progress.speedBps,
                  etaSecs: progress.etaSecs ?? undefined,
                }
              : task;
          });
          return deriveGroup(group, nextTasks);
        })
      );
    });
    const stopState = DownloadService.onState((event) => {
      if (event.kind === "group_submitted") {
        void refreshDownloadGroups();
        return;
      }
      setTasks((groups) =>
        groups.map((group) => {
          if (group.id !== event.groupId) return group;
          if (event.kind === "group_state_changed") {
            return deriveGroup({ ...group, state: event.new }, group.tasks);
          }
          return deriveGroup(
            group,
            group.tasks.map((task) =>
              task.id === event.taskId ? { ...task, state: event.new } : task
            )
          );
        })
      );
      if (event.kind === "group_state_changed") {
        void refreshDownloadGroups();
      }
    });
    const stopError = DownloadService.onError((event) => {
      logger.error(
        `Download ${event.taskId} in group ${event.groupId} failed: ${taskErrorText(event.error)}`
      );
      setTasks((groups) =>
        groups.map((group) =>
          group.id === event.groupId
            ? deriveGroup(
                group,
                group.tasks.map((task) =>
                  task.id === event.taskId
                    ? {
                        ...task,
                        state: DownloadTaskState.Failed,
                        error: event.error,
                      }
                    : task
                )
              )
            : group
        )
      );
    });
    const stopVerified = DownloadService.onVerified((event) => {
      setTasks((groups) =>
        groups.map((group) =>
          group.id === event.groupId
            ? deriveGroup(
                group,
                group.tasks.map((task) =>
                  task.id === event.taskId ? { ...task, verified: true } : task
                )
              )
            : group
        )
      );
    });
    const stopFinished = DownloadService.onFinished(
      async (event: DownloadFinishedEvent) => {
        try {
          const summary = (await DownloadService.snapshot()).find(
            (group) => group.id === event.groupId
          );
          if (!summary) return;
          const group = await loadGroup(summary);
          setTasks((groups) => [
            group,
            ...groups.filter((item) => item.id !== group.id),
          ]);
          const statusKey =
            event.finish === DownloadFinishKind.Completed
              ? "Completed"
              : event.finish === DownloadFinishKind.Failed
                ? "Failed"
                : "Cancelled";
          const parsed = parseTaskGroup(group.name);
          toast({
            status:
              event.finish === DownloadFinishKind.Failed ? "error" : "success",
            title: t(
              `Services.task.onDownloadGroupUpdate.status.${statusKey}`,
              {
                param: t(
                  `DownloadTasksPage.task.${parsed.name}`,
                  parsed.params
                ),
              }
            ),
          });
          if (event.finish === DownloadFinishKind.Completed) {
            handleCompletedGroup(group);
          }
        } catch (error) {
          showCommandError(error);
        }
      }
    );
    return () => {
      stopTick();
      stopState();
      stopError();
      stopVerified();
      stopFinished();
    };
  }, [
    handleCompletedGroup,
    loadGroup,
    refreshDownloadGroups,
    showCommandError,
    t,
    toast,
  ]);

  const generalPercent = useMemo(() => {
    const active = tasks.filter(
      (group) => group.state === DownloadGroupState.Active
    );
    if (!active.length) return undefined;
    return active.reduce(
      (total, group) => total + (group.progress ?? 0) / active.length,
      0
    );
  }, [tasks]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        generalPercent,
        handleSubmitDownloadGroup,
        handleCancelDownloadGroup,
        handlePauseDownloadGroup,
        handleResumeDownloadGroup,
        handleRetryDownloadGroup,
        handleClearDownloadHistory,
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
  isRetry: boolean;
  rawName: string;
} => {
  const rawName = taskGroup.includes("@")
    ? taskGroup.substring(0, taskGroup.lastIndexOf("@"))
    : taskGroup;
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
    rawName,
  };
};

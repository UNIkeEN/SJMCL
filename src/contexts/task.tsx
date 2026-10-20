import { emit } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
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
  DownloadGroupSummary,
  DownloadTask,
  DownloadTaskState,
  SubmitDownloadTask,
} from "@/models/download";
import { ConfigService } from "@/services/config";
import { DownloadService } from "@/services/download";
import {
  EXTENSION_REFRESH_EVENT,
  ExtensionService,
} from "@/services/extension";
import { RESOURCE_REFRESH_EVENT } from "@/services/resource";
import {
  estimateDownloadGroupEta,
  getDownloadErrorText,
  getDownloadStats,
  shouldShowDownloadProgress,
} from "@/utils/download";

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
  summary: DownloadGroupSummary & Pick<DownloadGroup, "etaSample">,
  tasks: DownloadTask[]
): DownloadGroup => {
  const derivedTasks = tasks
    .map((task) => {
      // Keep automatic retries pending in the UI until a terminal failure is reported.
      const waitingForRetry =
        task.state === DownloadTaskState.Failed &&
        !task.retriesExhausted &&
        summary.state !== DownloadGroupState.Draining &&
        summary.state !== DownloadGroupState.Finished;
      const state = waitingForRetry ? DownloadTaskState.Pending : task.state;
      return {
        ...task,
        state,
        speedBps: waitingForRetry ? undefined : task.speedBps,
        etaSecs: waitingForRetry ? undefined : task.etaSecs,
        progress:
          state === DownloadTaskState.Done
            ? 100
            : task.total
              ? (task.received * 100) / task.total
              : 0,
      };
    })
    .sort((left, right) => taskOrder(left.state) - taskOrder(right.state));
  const stats = getDownloadStats(derivedTasks);
  // Count only downloaded files so installation steps do not affect progress.
  const progress = stats.total ? (stats.done * 100) / stats.total : 0;
  return {
    ...summary,
    tasks: derivedTasks,
    stats,
    progress,
    ...estimateDownloadGroupEta(summary.state, derivedTasks, summary.etaSample),
    error: getDownloadErrorText(
      derivedTasks.find((task) => task.retriesExhausted && task.error)?.error ??
        null
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
  const { getInstanceList } = useGlobalData();
  const { config, getJavaInfos } = useLauncherConfig();
  const { openSharedModal, openGenericConfirmDialog, modalStates } =
    useSharedModals();
  const [tasks, setTasks] = useState<DownloadGroup[]>([]);
  const tasksRef = useRef<DownloadGroup[]>([]);
  const { t } = useTranslation();
  const refreshSequence = useRef(0);
  const completionInFlight = useRef<string | null>(null);
  const completionOnClose = useRef<(() => void) | null>(null);
  const handledCompletions = useRef(new Set<string>());
  const [completionProcessing, setCompletionProcessing] = useState(false);

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
      return deriveGroup(
        {
          ...summary,
          etaSample:
            previous?.state === summary.state ? previous.etaSample : undefined,
        },
        mergeRuntimeProgress(groupTasks, previous)
      );
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
      (group) =>
        group.state === DownloadGroupState.Finished && !group.completionPending
    );
    Promise.all(finished.map((group) => DownloadService.removeGroup(group.id)))
      .then(() => {
        setTasks((current) =>
          current.filter(
            (group) => !finished.some((item) => item.id === group.id)
          )
        );
      })
      .catch(showCommandError);
  }, [showCommandError, tasks]);

  const handleCompletedGroup = useCallback(
    (group: DownloadGroup, onHandled: () => Promise<boolean>) => {
      const { name, params } = parseTaskGroup(group.name);
      switch (name) {
        case "game-client":
        case "change-mod-loader":
        case "change-optifine":
        case "forge-libraries":
        case "cleanroom-libraries":
        case "neoforge-libraries":
        case "optifine-libraries":
          getInstanceList(true);
          break;
        case "game-client-w-java":
          getInstanceList(true);
          getJavaInfos(true);
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
        case "modpack":
          if (group.tasks[0]?.dest) {
            openSharedModal("import-modpack", {
              path: group.tasks[0].dest,
              onCloseCallback: onHandled,
            });
            return;
          }
          break;
        case "launcher-update":
          if (group.tasks[0]) {
            const task = group.tasks[0];
            const isWinInstaller =
              config.basicInfo.osType === "windows" &&
              !config.basicInfo.isPortable;
            openGenericConfirmDialog({
              onCloseCallback: onHandled,
              title: t("RestartForUpdateConfirmDialog.title"),
              body: t(
                `RestartForUpdateConfirmDialog.${isWinInstaller ? "bodyWinInstaller" : "body"}`
              ),
              btnOK: t(
                `RestartForUpdateConfirmDialog.button.${isWinInstaller ? "install" : "restart"}`
              ),
              btnCancel: t("RestartForUpdateConfirmDialog.button.later"),
              onOKCallback: async () => {
                if (!(await onHandled())) return;
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
              onCancelCallback: async () => {
                if (!(await onHandled())) return;
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
            return;
          }
          break;
        case "extension-update": {
          const task = group.tasks[0];
          const expectedIdentifier = params.param1;
          const newVersion = params.param2 || "";
          if (task?.dest && "url" in task.spec && expectedIdentifier) {
            openGenericConfirmDialog({
              onCloseCallback: onHandled,
              title: t("ExtensionUpdateConfirmDialog.title"),
              body: t("ExtensionUpdateConfirmDialog.body", {
                identifier: expectedIdentifier,
                version: newVersion,
                src: task.spec.url,
              }),
              onOKCallback: async () => {
                if (!(await onHandled())) return;
                ExtensionService.addExtension(
                  task.dest!,
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
            return;
          }
          break;
        }
        case "mojang-java":
          getJavaInfos(true);
          break;
      }
      void onHandled();
    },
    [
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
    if (
      completionInFlight.current &&
      !handledCompletions.current.has(completionInFlight.current)
    ) {
      const visible = Object.values(modalStates).some(
        (modal) => modal.onCloseCallback === completionOnClose.current
      );
      if (!visible) {
        // Another dialog replaced this prompt. Keep its action pending for later.
        completionInFlight.current = null;
        setCompletionProcessing(false);
      }
      return;
    }
    if (
      getCurrentWebview().label !== "main" ||
      completionInFlight.current ||
      completionProcessing ||
      modalStates["generic-confirm"]?.isOpen ||
      modalStates["import-modpack"]?.isOpen
    )
      return;
    const group = tasks.find(
      (item) =>
        item.completionPending && !handledCompletions.current.has(item.id)
    );
    if (!group) return;
    completionInFlight.current = group.id;
    setCompletionProcessing(true);
    let acknowledgement: Promise<boolean> | undefined;
    const onHandled = (): Promise<boolean> => {
      if (acknowledgement) return acknowledgement;
      handledCompletions.current.add(group.id);
      acknowledgement = DownloadService.acknowledgeCompletion(group.id)
        .then(() => {
          setTasks((current) =>
            current.map((item) =>
              item.id === group.id
                ? { ...item, completionPending: false }
                : item
            )
          );
          return true;
        })
        .catch((error) => {
          showCommandError(error);
          return false;
        })
        .finally(() => {
          if (completionInFlight.current === group.id) {
            completionInFlight.current = null;
            setCompletionProcessing(false);
          }
        });
      return acknowledgement;
    };
    completionOnClose.current = onHandled;
    handleCompletedGroup(group, onHandled);
  }, [
    completionProcessing,
    handleCompletedGroup,
    modalStates,
    showCommandError,
    tasks,
  ]);

  useEffect(() => {
    let attached = true;
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
        `Download ${event.taskId} in group ${event.groupId} failed: ${getDownloadErrorText(event.error)}`
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
                        retriesExhausted: true,
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
        } catch (error) {
          showCommandError(error);
        }
      }
    );
    const subscriptions = [
      stopTick,
      stopState,
      stopError,
      stopVerified,
      stopFinished,
    ];
    void Promise.all(subscriptions)
      .then(() => {
        if (attached) void refreshDownloadGroups();
      })
      .catch(showCommandError);
    return () => {
      attached = false;
      subscriptions.forEach((subscription) => {
        void subscription.then((stop) => stop()).catch(showCommandError);
      });
    };
  }, [loadGroup, refreshDownloadGroups, showCommandError, t, toast]);

  const generalPercent = useMemo(() => {
    const active = tasks.filter(
      (group) =>
        group.state === DownloadGroupState.Active &&
        shouldShowDownloadProgress(group)
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
  rawName: string;
} => {
  const rawName = taskGroup.includes("@")
    ? taskGroup.substring(0, taskGroup.lastIndexOf("@"))
    : taskGroup;
  const [name, paramString] = rawName.split("?");
  const params = paramString ? paramString.split("&") : [];
  return {
    name,
    params:
      params.length === 1
        ? { param: params[0] }
        : Object.fromEntries(
            params.map((param, index) => [`param${index + 1}`, param])
          ),
    rawName,
  };
};

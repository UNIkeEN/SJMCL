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
  type DownloadSnapshotUpdates,
  estimateDownloadGroupEta,
  getDownloadErrorText,
  getDownloadGroupProgress,
  getDownloadStats,
  mergeDownloadSnapshot,
  shouldShowDownloadProgress,
} from "@/utils/download";

interface DownloadCompletion {
  onHandled: (onAcknowledged?: () => void) => Promise<void>;
  acknowledgement?: Promise<void>;
}

interface TaskContextType {
  tasks: DownloadGroup[];
  completionFailures: Record<string, { error: unknown; retry: () => void }>;
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
              ? Math.min(100, Math.max(0, (task.received * 100) / task.total))
              : undefined,
      };
    })
    .sort((left, right) => taskOrder(left.state) - taskOrder(right.state));
  const stats = getDownloadStats(derivedTasks);
  const progress = getDownloadGroupProgress(derivedTasks);
  return {
    ...summary,
    tasks: derivedTasks,
    stats,
    progress,
    ...estimateDownloadGroupEta(summary.state, derivedTasks, summary.etaSample),
    error:
      derivedTasks.find((task) => task.retriesExhausted && task.error)?.error ??
      undefined,
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
  const pendingSnapshots = useRef(new Set<DownloadSnapshotUpdates>());
  const completion = useRef<DownloadCompletion | null>(null);
  const [completionFailures, setCompletionFailures] = useState<
    TaskContextType["completionFailures"]
  >({});

  const recordTaskUpdate = useCallback(
    (taskId: string, update: Partial<DownloadTask>) => {
      pendingSnapshots.current.forEach((snapshot) => {
        snapshot.tasks.set(taskId, {
          ...snapshot.tasks.get(taskId),
          ...update,
        });
      });
    },
    []
  );

  const recordGroupUpdate = useCallback(
    (groupId: string, update: Partial<DownloadGroupSummary>) => {
      pendingSnapshots.current.forEach((snapshot) => {
        snapshot.groups.set(groupId, {
          ...snapshot.groups.get(groupId),
          ...update,
        });
      });
    },
    []
  );

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const showCommandError = useCallback(
    (error: unknown) => {
      toast({
        title: t("Services.task.common.title"),
        description: getDownloadErrorText(error, t),
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
    const updates: DownloadSnapshotUpdates = {
      tasks: new Map(),
      groups: new Map(),
    };
    pendingSnapshots.current.add(updates);
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
      setTasks(
        groups.map((group) => {
          const merged = mergeDownloadSnapshot(group, updates);
          return deriveGroup(merged, merged.tasks);
        })
      );
    } catch (error) {
      showCommandError(error);
    } finally {
      pendingSnapshots.current.delete(updates);
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
    (group: DownloadGroup, onHandled: DownloadCompletion["onHandled"]) => {
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
              onOKCallback: () =>
                onHandled(() => {
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
                }),
              onCancelCallback: () =>
                onHandled(() => {
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
                }),
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
              onOKCallback: () =>
                onHandled(() => {
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
                }),
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
    if (completion.current && !completion.current.acknowledgement) {
      const visible = modalStates.some(
        (modal) =>
          modal.params.onCloseCallback === completion.current?.onHandled
      );
      if (!visible) {
        // Another dialog replaced this prompt. Keep its action pending for later.
        completion.current = null;
      }
    }
    if (
      getCurrentWebview().label !== "main" ||
      completion.current ||
      modalStates.some(
        ({ key }) => key === "generic-confirm" || key === "import-modpack"
      )
    )
      return;
    const group = tasks.find(
      (item) => item.completionPending && !completionFailures[item.id]
    );
    if (!group) return;
    const current: DownloadCompletion = {
      onHandled: (onAcknowledged) => {
        if (current.acknowledgement) return current.acknowledgement;
        current.acknowledgement = DownloadService.acknowledgeCompletion(
          group.id
        )
          .then(
            () => {
              recordGroupUpdate(group.id, { completionPending: false });
              setTasks((current) =>
                current.map((item) =>
                  item.id === group.id
                    ? { ...item, completionPending: false }
                    : item
                )
              );
              setCompletionFailures((failures) => {
                const { [group.id]: _, ...remaining } = failures;
                return remaining;
              });
              onAcknowledged?.();
            },
            (error) => {
              current.acknowledgement = undefined;
              setCompletionFailures((failures) => ({
                ...failures,
                [group.id]: {
                  error,
                  // Retry acknowledgement with the original choice, without replaying the prompt.
                  retry: () => {
                    void current.onHandled(onAcknowledged);
                  },
                },
              }));
              showCommandError(error);
            }
          )
          .finally(() => {
            if (completion.current === current) {
              completion.current = null;
            }
          });
        return current.acknowledgement;
      },
    };
    completion.current = current;
    handleCompletedGroup(group, current.onHandled);
  }, [
    completionFailures,
    handleCompletedGroup,
    modalStates,
    recordGroupUpdate,
    showCommandError,
    tasks,
  ]);

  useEffect(() => {
    let attached = true;
    const pendingTaskUpdates = new Map<
      string,
      { groupId: string; update: Partial<DownloadTask> }
    >();
    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    const flushTaskUpdates = () => {
      clearTimeout(updateTimer);
      updateTimer = undefined;
      if (!pendingTaskUpdates.size) return;
      const updates = new Map(pendingTaskUpdates);
      pendingTaskUpdates.clear();
      const groupIds = new Set(
        [...updates.values()].map((item) => item.groupId)
      );
      setTasks((groups) =>
        groups.map((group) => {
          if (!groupIds.has(group.id)) return group;
          return deriveGroup(
            group,
            group.tasks.map((task) => {
              const pending = updates.get(task.id);
              return pending ? { ...task, ...pending.update } : task;
            })
          );
        })
      );
    };
    const queueTaskUpdate = (
      groupId: string,
      taskId: string,
      update: Partial<DownloadTask>
    ) => {
      // Snapshot overlays must see events immediately, before the batched render.
      recordTaskUpdate(taskId, update);
      pendingTaskUpdates.set(taskId, {
        groupId,
        update: { ...pendingTaskUpdates.get(taskId)?.update, ...update },
      });
      updateTimer ??= setTimeout(flushTaskUpdates, 200);
    };
    const stopTick = DownloadService.onTick((updates) => {
      updates.forEach((progress) => {
        queueTaskUpdate(progress.groupId, progress.taskId, {
          state: progress.state,
          received: progress.received,
          total: progress.total,
          speedBps: progress.speedBps,
          etaSecs: progress.etaSecs ?? undefined,
        });
      });
    });
    const stopState = DownloadService.onState((event) => {
      if (event.kind === "group_submitted") {
        flushTaskUpdates();
        void refreshDownloadGroups();
        return;
      }
      if (event.kind === "task_state_changed") {
        queueTaskUpdate(event.groupId, event.taskId, {
          state: event.new,
          ...(event.new === DownloadTaskState.Pending ||
          event.new === DownloadTaskState.Downloading
            ? { error: null, retriesExhausted: false }
            : {}),
        });
        return;
      }
      const groupUpdate = {
        state: event.new,
        ...(event.new !== DownloadGroupState.Finished
          ? { finish: null, completionPending: false }
          : {}),
      };
      recordGroupUpdate(event.groupId, groupUpdate);
      flushTaskUpdates();
      setTasks((groups) =>
        groups.map((group) =>
          group.id === event.groupId
            ? deriveGroup({ ...group, ...groupUpdate }, group.tasks)
            : group
        )
      );
      void refreshDownloadGroups();
    });
    const stopError = DownloadService.onError((event) => {
      flushTaskUpdates();
      logger.error(
        `Download ${event.taskId} in group ${event.groupId} failed: ${JSON.stringify(event.error)}`
      );
      const update: Partial<DownloadTask> = {
        state: DownloadTaskState.Failed,
        error: event.error,
        retriesExhausted: true,
      };
      recordTaskUpdate(event.taskId, update);
      setTasks((groups) =>
        groups.map((group) =>
          group.id === event.groupId
            ? deriveGroup(
                group,
                group.tasks.map((task) =>
                  task.id === event.taskId ? { ...task, ...update } : task
                )
              )
            : group
        )
      );
    });
    const stopVerified = DownloadService.onVerified((event) => {
      queueTaskUpdate(event.groupId, event.taskId, { verified: true });
    });
    const stopFinished = DownloadService.onFinished(
      async (event: DownloadFinishedEvent) => {
        flushTaskUpdates();
        const updates: DownloadSnapshotUpdates = {
          tasks: new Map(),
          groups: new Map(),
        };
        pendingSnapshots.current.add(updates);
        try {
          const summary = (await DownloadService.snapshot()).find(
            (group) => group.id === event.groupId
          );
          if (!summary) return;
          const loaded = await loadGroup(summary);
          const merged = mergeDownloadSnapshot(loaded, updates);
          const group = deriveGroup(merged, merged.tasks);
          setTasks((groups) => [
            group,
            ...groups.filter((item) => item.id !== group.id),
          ]);
          if (
            group.state !== DownloadGroupState.Finished ||
            group.finish !== event.finish
          )
            return;
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
        } finally {
          pendingSnapshots.current.delete(updates);
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
      clearTimeout(updateTimer);
      subscriptions.forEach((subscription) => {
        void subscription.then((stop) => stop()).catch(showCommandError);
      });
    };
  }, [
    loadGroup,
    recordGroupUpdate,
    recordTaskUpdate,
    refreshDownloadGroups,
    showCommandError,
    t,
    toast,
  ]);

  const generalPercent = useMemo(() => {
    const active = tasks.filter(
      (group) =>
        group.state === DownloadGroupState.Active &&
        shouldShowDownloadProgress(group)
    );
    if (!active.length) return undefined;
    if (active.every((group) => group.progress == null)) return undefined;
    return active.reduce(
      (total, group) => total + (group.progress ?? 0) / active.length,
      0
    );
  }, [tasks]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        completionFailures,
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

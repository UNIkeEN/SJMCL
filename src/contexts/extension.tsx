import * as ChakraUI from "@chakra-ui/react";
import { convertFileSrc, invoke as tauriInvoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { t } from "i18next";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { WrapCard, WrapCardGroup } from "@/components/common/wrap-card";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { useGetState } from "@/hooks/get-state";
import {
  ExtensionAbility,
  ExtensionAbilityActions,
  ExtensionAbilityData,
  ExtensionAbilityState,
  ExtensionHomeWidgetContribution,
  ExtensionHomeWidgetDefinition,
  ExtensionInfo,
  ExtensionSettingsPageContribution,
  ExtensionSettingsPageDefinition,
} from "@/models/extension";
import { ExtensionService } from "@/services/extension";
import { UtilsService } from "@/services/utils";

interface ExtensionContextRegistration {
  homeWidget?: ExtensionHomeWidgetDefinition;
  homeWidgets?: ExtensionHomeWidgetDefinition[];
  settingsPage?: ExtensionSettingsPageDefinition;
  dispose?: () => void;
}

interface ExtensionContextRegistrationApi {
  React: typeof React;
  ChakraUI: typeof ChakraUI;
  Components: {
    OptionItem: typeof OptionItem;
    OptionItemGroup: typeof OptionItemGroup;
    Section: typeof Section;
    WrapCard: typeof WrapCard;
    WrapCardGroup: typeof WrapCardGroup;
  };
  identifier: string;
  resolveAssetUrl: (path: string) => string;
  useHostContext: () => ExtensionAbility;
}

type ExtensionContextFactory = (
  api: ExtensionContextRegistrationApi
) => ExtensionContextRegistration | void;

type ExtensionRegistrationFunction = (
  factory: ExtensionContextFactory,
  token: string
) => void;

interface ActiveExtensionRecord {
  dispose?: () => void;
  scriptElement?: HTMLScriptElement;
  signature: string;
}

interface PendingRegistration {
  identifier: string;
  token: string;
  resolve: (factory: ExtensionContextFactory) => void;
  reject: (error: unknown) => void;
}

interface ExtensionStateStore {
  [identifier: string]: Record<string, unknown>;
}

interface ExtensionHostStoreState {
  getValue: <T>(identifier: string, key: string, initialValue: T) => T;
  setValue: <T>(
    identifier: string,
    key: string,
    value: React.SetStateAction<T>,
    initialValue: T
  ) => void;
  subscribe: (
    identifier: string,
    key: string,
    listener: () => void
  ) => () => void;
}

interface ExtensionHostContextType {
  // host internals used to build ExtensionContextValue for each extension.
  data: Omit<ExtensionAbilityData, "routeQuery">;
  actions?: ExtensionAbilityActions; // will be created per-extension with restricted capabilities.
  stateStore: ExtensionHostStoreState;
  // extension runtime registry state managed by host.
  extensionList: ExtensionInfo[] | undefined;
  enabledExtensionList: ExtensionInfo[] | undefined;
  homeWidgets: ExtensionHomeWidgetContribution[];
  getExtensionSettingsPage: (
    identifier: string
  ) => ExtensionSettingsPageContribution | undefined;
  // host control methods.
  getExtensionList: (sync?: boolean) => ExtensionInfo[] | undefined;
}

const ExtensionHostContext = createContext<
  ExtensionHostContextType | undefined
>(undefined);

// sanitize extension paths and block absolute/".." traversal.
const sanitizePath = (path: string) => {
  const normalized = path.replace(/\\/g, "/").trim();
  if (!normalized || normalized.startsWith("/") || normalized.includes("..")) {
    return undefined;
  }
  return normalized;
};

const joinUrlPath = (basePath: string, relativePath: string) => {
  const normalizedBase = basePath.replace(/\\/g, "/").replace(/\/+$/, "");
  return `${normalizedBase}/${relativePath}`;
};

// generate a unique token for each extension activation process.
const createActivationToken = () => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

// parse query params from current URL and expose them to extensions.
const parseRouteQuery = (): ExtensionAbilityData["routeQuery"] => {
  if (typeof window === "undefined") {
    return {};
  }

  const searchParams = new URLSearchParams(window.location.search);
  const routeQuery: ExtensionAbilityData["routeQuery"] = {};

  searchParams.forEach((value, key) => {
    const current = routeQuery[key];
    if (current === undefined) {
      routeQuery[key] = value;
      return;
    }

    if (Array.isArray(current)) {
      routeQuery[key] = [...current, value];
      return;
    }

    routeQuery[key] = [current, value];
  });

  return routeQuery;
};

/**
 * Extension host architecture overview:
 * 1) The host retrieves installed extension metadata from backend and filters
 *    enabled extensions from launcher config.
 * 2) For each enabled extension with a frontend entry, the host injects its
 *    script and waits for a `window.registerExtension(...)` handshake.
 * 3) The host executes the factory with a constrained API surface
 *    (React/Chakra + host context + scoped state helpers).
 * 4) Returned registrations are converted into runtime contributions
 *    (e.g. home widgets) and tracked by extension identifier.
 * 5) A sync loop re-evaluates activation signatures and performs reload/teardown
 *    to keep runtime consistent with extension list/config changes.
 */
export const ExtensionHostContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { config, update } = useLauncherConfig();
  const { selectedPlayer, selectedInstance, getPlayerList, getInstanceList } =
    useGlobalData();
  const { openSharedModal } = useSharedModals();
  const toast = useToast();

  const [extensionList, setExtensionList] = useState<ExtensionInfo[]>();
  const [extensionListVersion, setExtensionListVersion] = useState(0);
  const [extensionRuntimeVersionMap, setExtensionRuntimeVersionMap] = useState<
    Record<string, number>
  >({}); // bump this to trigger reload for a specific extension.
  const [playerList, setPlayerList] = useState<
    ExtensionAbilityData["playerList"]
  >([]);
  const [instanceList, setInstanceList] = useState<
    ExtensionAbilityData["instanceList"]
  >([]);

  const [homeWidgetMap, setHomeWidgetMap] = useState<
    Record<string, ExtensionHomeWidgetContribution[]>
  >({});
  const [settingsPageMap, setSettingsPageMap] = useState<
    Record<string, ExtensionSettingsPageContribution>
  >({});

  // pending registration, active extensions, and per-extension state stores/listeners.
  const pendingRegistrationsRef = useRef<Record<string, PendingRegistration>>(
    {}
  );
  const activeExtensionsRef = useRef<Record<string, ActiveExtensionRecord>>({});
  const activatingExtensionsRef = useRef<Record<string, string>>({});
  const extensionStateStoreRef = useRef<ExtensionStateStore>({});
  const extensionStateListenerRef = useRef<
    Record<string, Record<string, Set<() => void>>>
  >({});

  const invoke = useCallback<ExtensionAbility["actions"]["invoke"]>(
    async <T,>(command: string, payload?: Record<string, unknown>) => {
      if (
        [
          "delete_file",
          "delete_directory",
          "read_file",
          "write_file",
          "request",
        ].includes(command)
      ) {
        throw new Error(`Direct invoke is not allowed for ${command}`);
      }

      return await tauriInvoke<T>(command, payload);
    },
    []
  );

  const requestText = useCallback<ExtensionAbility["actions"]["requestText"]>(
    async (url: string, init?: RequestInit) => {
      const response = await UtilsService.request(url, init?.method, {
        headers: init?.headers,
        body: init?.body,
      });
      if (response.status === "error") {
        throw response.raw_error || response.details || response.message;
      }
      return response.data;
    },
    []
  );

  // keep host data snapshot in ref to avoid stale closure in extension APIs.
  const extensionDataRef = useRef<Omit<ExtensionAbilityData, "routeQuery">>({
    config,
    selectedPlayer,
    selectedInstance,
    playerList,
    instanceList,
  });
  extensionDataRef.current = {
    config,
    selectedPlayer,
    selectedInstance,
    playerList,
    instanceList,
  };

  const handleRetrieveExtensionList = useCallback(() => {
    ExtensionService.retrieveExtensionList().then((response) => {
      if (response.status === "success") {
        setExtensionList(response.data);
        setExtensionListVersion((prev) => prev + 1);
      } else {
        setExtensionList([]);
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  }, [toast]);

  const getExtensionList = useGetState(
    extensionList,
    handleRetrieveExtensionList
  );

  useEffect(() => {
    handleRetrieveExtensionList();
  }, [handleRetrieveExtensionList]);

  useEffect(() => {
    setPlayerList(getPlayerList() || []);
  }, [getPlayerList]);

  useEffect(() => {
    setInstanceList(getInstanceList() || []);
  }, [getInstanceList]);

  // Register global window.registerExtension entry to receive extension factory.
  useEffect(() => {
    const registerExtension: ExtensionRegistrationFunction = (
      factory,
      token
    ) => {
      const pending = pendingRegistrationsRef.current[token];
      if (!pending) {
        logger.error(
          `Received extension registration with unknown token ${token}`
        );
        return;
      }
      pending.resolve(factory);
      delete pendingRegistrationsRef.current[token];
    };

    window.registerExtension = registerExtension;

    return () => {
      if (window.registerExtension === registerExtension) {
        delete window.registerExtension;
      }
    };
  }, []);

  const enabledExtensionList = useMemo(() => {
    if (!extensionList) return undefined;
    const enabledSet = new Set(config.extension.enabled);
    return extensionList.filter((extension) =>
      enabledSet.has(extension.identifier)
    );
  }, [config.extension.enabled, extensionList]);

  // ------------- Spec contributions for rendering --------------
  const homeWidgets = useMemo(() => {
    if (!enabledExtensionList) {
      return Object.values(homeWidgetMap).flat();
    }
    return enabledExtensionList
      .flatMap((extension) => homeWidgetMap[extension.identifier] || [])
      .filter(Boolean);
  }, [enabledExtensionList, homeWidgetMap]);

  const getExtensionSettingsPage = useCallback(
    (identifier: string) => settingsPageMap[identifier],
    [settingsPageMap]
  );

  const removeExtensionContributionState = useCallback((identifier: string) => {
    setHomeWidgetMap((prev) => {
      const next = { ...prev };
      delete next[identifier];
      return next;
    });
    setSettingsPageMap((prev) => {
      const next = { ...prev };
      delete next[identifier];
      return next;
    });

    delete extensionStateStoreRef.current[identifier];
    delete extensionStateListenerRef.current[identifier];
  }, []);

  // ------------- Extension-scoped state management -------------
  const getExtensionStateValue = useCallback(
    <T,>(identifier: string, key: string, initialValue: T): T => {
      if (!extensionStateStoreRef.current[identifier]) {
        extensionStateStoreRef.current[identifier] = {};
      }

      if (!(key in extensionStateStoreRef.current[identifier])) {
        extensionStateStoreRef.current[identifier][key] = initialValue;
      }

      return extensionStateStoreRef.current[identifier][key] as T;
    },
    []
  );

  const subscribeExtensionState = useCallback(
    (identifier: string, key: string, listener: () => void) => {
      if (!extensionStateListenerRef.current[identifier]) {
        extensionStateListenerRef.current[identifier] = {};
      }
      if (!extensionStateListenerRef.current[identifier][key]) {
        extensionStateListenerRef.current[identifier][key] = new Set();
      }

      extensionStateListenerRef.current[identifier][key].add(listener);

      return () => {
        extensionStateListenerRef.current[identifier]?.[key]?.delete(listener);
      };
    },
    []
  );

  const setExtensionStateValue = useCallback(
    <T,>(
      identifier: string,
      key: string,
      value: React.SetStateAction<T>,
      initialValue: T
    ) => {
      const previous = getExtensionStateValue(identifier, key, initialValue);
      const next =
        typeof value === "function"
          ? (value as (prev: T) => T)(previous)
          : value;

      if (!extensionStateStoreRef.current[identifier]) {
        extensionStateStoreRef.current[identifier] = {};
      }
      extensionStateStoreRef.current[identifier][key] = next;

      extensionStateListenerRef.current[identifier]?.[key]?.forEach(
        (listener) => {
          listener();
        }
      );
    },
    [getExtensionStateValue]
  );

  // create scoped useExtensionState hook for a specific extension.
  const createUseExtensionState = useCallback(
    (identifier: string): ExtensionAbilityState["useExtensionState"] => {
      return function useExtensionState<T>(key: string, initialValue: T) {
        const initialRef = useRef(initialValue);

        const value = useSyncExternalStore(
          (listener) => subscribeExtensionState(identifier, key, listener),
          () => getExtensionStateValue(identifier, key, initialRef.current),
          () => initialRef.current
        );

        const setValue = (nextValue: React.SetStateAction<T>) => {
          setExtensionStateValue(
            identifier,
            key,
            nextValue,
            initialRef.current
          );
        };

        return [value, setValue];
      };
    },
    [getExtensionStateValue, setExtensionStateValue, subscribeExtensionState]
  );

  // ------ Extension-scoped sensitive operations (fs, etc.) -----
  const resolveExtensionDataPath = useCallback(
    async (extension: ExtensionInfo, path: string) => {
      const relativePath = sanitizePath(path);
      if (!relativePath) {
        throw new Error(`Invalid extension data path: ${path}`);
      }

      return await join(extension.path, "data", relativePath); // "<extension-identifier>/data"
    },
    []
  );

  // run a utils file command under the current extension's private data dir.
  const runExtensionFileCommand = useCallback(
    async <T,>(
      extension: ExtensionInfo,
      path: string,
      action: (fullPath: string) => Promise<{
        status: string;
        data?: T;
        raw_error?: string;
        details?: string;
        message: string;
      }>
    ) => {
      const fullPath = await resolveExtensionDataPath(extension, path);
      const response = await action(fullPath);
      if (response.status === "error") {
        throw response.raw_error || response.details || response.message;
      }
      return response.data as T;
    },
    [resolveExtensionDataPath]
  );

  // -------------- Extension-scoped actions ability -------------
  const createExtensionActions = useCallback(
    (extension: ExtensionInfo): ExtensionAbilityActions => ({
      getPlayerList,
      getInstanceList,
      updateConfig: update,
      invoke,
      requestText,
      openSharedModal,
      readFile: async (path: string) =>
        runExtensionFileCommand(extension, path, UtilsService.readFile),
      writeFile: async (path: string, content: string) => {
        await runExtensionFileCommand(extension, path, (fullPath) =>
          UtilsService.writeFile(fullPath, content)
        );
      },
      deleteFile: async (path: string) => {
        await runExtensionFileCommand(extension, path, UtilsService.deleteFile);
      },
      deleteDirectory: async (path: string) => {
        await runExtensionFileCommand(
          extension,
          path,
          UtilsService.deleteDirectory
        );
      },
      reloadSelf: () =>
        setExtensionRuntimeVersionMap((previous) => ({
          ...previous,
          [extension.identifier]: (previous[extension.identifier] || 0) + 1,
        })),
    }),
    [
      getPlayerList,
      getInstanceList,
      update,
      invoke,
      requestText,
      openSharedModal,
      runExtensionFileCommand,
    ]
  );

  // build host context object injected into extension instance.
  const createExtensionContextValue = useCallback(
    (extension: ExtensionInfo): ExtensionAbility => ({
      data: {
        ...extensionDataRef.current,
        routeQuery: parseRouteQuery(),
      },
      actions: createExtensionActions(extension),
      state: {
        useExtensionState: createUseExtensionState(extension.identifier),
      },
    }),
    [createExtensionActions, createUseExtensionState]
  );

  // build extension script URL (extension dir + entry + cache-busting query).
  const getScriptUrl = useCallback(
    async (extension: ExtensionInfo, nonce: string, token: string) => {
      const entry = sanitizePath(extension.frontend?.entry || "");
      if (!entry) {
        throw new Error(
          `Invalid frontend entry for extension ${extension.identifier}`
        );
      }
      const fullPath = await join(extension.path, entry);

      return `${convertFileSrc(fullPath)}?extension=${encodeURIComponent(extension.identifier)}&token=${encodeURIComponent(token)}&v=${nonce}`;
    },
    []
  );

  // build extension asset URL (extension dir + asset path) by tauri's convertFileSrc.
  const getAssetUrl = useCallback((extension: ExtensionInfo, path: string) => {
    const relativePath = sanitizePath(path);
    if (!relativePath) {
      throw new Error(`Invalid extension asset path: ${path}`);
    }

    return convertFileSrc(joinUrlPath(extension.path, relativePath));
  }, []);

  // inject script and wait for extension to call registerExtension with factory.
  const loadExtensionFactory = useCallback(
    async (extension: ExtensionInfo, signature: string) => {
      const activationToken = createActivationToken();
      const scriptUrl = await getScriptUrl(
        extension,
        signature,
        activationToken
      );

      return await new Promise<{
        factory: ExtensionContextFactory;
        scriptElement: HTMLScriptElement;
      }>((resolve, reject) => {
        let settled = false;
        let registrationTimeout: number | undefined;
        const scriptElement = document.createElement("script");
        scriptElement.src = scriptUrl;
        scriptElement.async = false;
        scriptElement.dataset.extensionIdentifier = extension.identifier;
        scriptElement.dataset.extensionToken = activationToken;

        // remove script and clear pending state on failure.
        const rejectWithCleanup = (error: unknown) => {
          if (settled) return;
          settled = true;
          if (registrationTimeout !== undefined) {
            window.clearTimeout(registrationTimeout);
          }
          if (
            pendingRegistrationsRef.current[activationToken]?.identifier ===
            extension.identifier
          ) {
            delete pendingRegistrationsRef.current[activationToken];
          }
          scriptElement.remove();
          reject(error);
        };

        pendingRegistrationsRef.current[activationToken] = {
          identifier: extension.identifier,
          token: activationToken,
          resolve: (factory) => {
            if (settled) return;
            settled = true;
            if (registrationTimeout !== undefined) {
              window.clearTimeout(registrationTimeout);
            }
            resolve({ factory, scriptElement });
          },
          reject: (error) => {
            rejectWithCleanup(error);
          },
        };

        registrationTimeout = window.setTimeout(() => {
          rejectWithCleanup(
            new Error(
              `Extension ${extension.identifier} did not call registerExtension. Use registerExtension(factory, token).`
            )
          );
        }, 10000); // timeout for extension to call registerExtension after script load.

        scriptElement.onload = () => {};

        scriptElement.onerror = () => {
          rejectWithCleanup(
            new Error(`Failed to load script for ${extension.identifier}`)
          );
        };

        document.body.appendChild(scriptElement);
      });
    },
    [getScriptUrl]
  );

  const activateExtension = useCallback(
    async (extension: ExtensionInfo, signature: string) => {
      const { factory, scriptElement } = await loadExtensionFactory(
        extension,
        signature
      );

      const api: ExtensionContextRegistrationApi = {
        React,
        ChakraUI,
        Components: {
          OptionItem,
          OptionItemGroup,
          Section,
          WrapCard,
          WrapCardGroup,
        },
        identifier: extension.identifier,
        resolveAssetUrl: (path: string) => getAssetUrl(extension, path),
        useHostContext: () => createExtensionContextValue(extension),
      };

      const registration = (factory(api) || {}) as ExtensionContextRegistration;

      // Normalize extension-declared contributions into host-owned runtime maps.
      const homeWidgetDefinitions = [
        ...(registration.homeWidget ? [registration.homeWidget] : []),
        ...(registration.homeWidgets || []),
      ];

      if (homeWidgetDefinitions.length > 0) {
        setHomeWidgetMap((prev) => ({
          ...prev,
          [extension.identifier]: homeWidgetDefinitions.map(
            (homeWidget, index) => ({
              ...homeWidget,
              identifier:
                homeWidgetDefinitions.length === 1
                  ? extension.identifier
                  : `${extension.identifier}:${homeWidget.key || index}`,
              resetKey: `${extension.identifier}:${signature}:${homeWidget.key || index}`,
              extension,
            })
          ),
        }));
      } else {
        setHomeWidgetMap((prev) => {
          const next = { ...prev };
          delete next[extension.identifier];
          return next;
        });
      }

      if (registration.settingsPage) {
        setSettingsPageMap((prev) => ({
          ...prev,
          [extension.identifier]: {
            ...registration.settingsPage!,
            identifier: extension.identifier,
            resetKey: `${extension.identifier}:${signature}:settings`,
            extension,
          },
        }));
      } else {
        setSettingsPageMap((prev) => {
          const next = { ...prev };
          delete next[extension.identifier];
          return next;
        });
      }

      activeExtensionsRef.current[extension.identifier] = {
        dispose: registration.dispose,
        scriptElement,
        signature,
      };
    },
    [createExtensionContextValue, getAssetUrl, loadExtensionFactory]
  );

  const deactivateExtension = useCallback(
    (identifier: string) => {
      for (const [token, pending] of Object.entries(
        pendingRegistrationsRef.current
      )) {
        if (pending.identifier !== identifier) continue;
        pending.reject(
          new Error(`Extension ${identifier} activation cancelled`)
        );
        delete pendingRegistrationsRef.current[token];
      }

      delete activatingExtensionsRef.current[identifier];

      const active = activeExtensionsRef.current[identifier];
      if (active?.dispose) {
        try {
          active.dispose();
        } catch (error) {
          logger.error(`Failed to dispose extension ${identifier}`, error);
        }
      }

      active.scriptElement?.remove();
      delete activeExtensionsRef.current[identifier];
      removeExtensionContributionState(identifier);
    },
    [removeExtensionContributionState]
  );

  // Core runtime sync: activate/reload/deactivate extensions based on enabled list.
  useEffect(() => {
    let cancelled = false;

    const syncRuntime = async () => {
      if (!enabledExtensionList) return;

      const targets = enabledExtensionList.filter(
        (extension) => !!extension.frontend?.entry
      );
      const targetIds = new Set(
        targets.map((extension) => extension.identifier)
      );

      for (const [identifier, active] of Object.entries(
        activeExtensionsRef.current
      )) {
        const target = targets.find(
          (extension) => extension.identifier === identifier
        );
        const runtimeVersion = target
          ? extensionRuntimeVersionMap[target.identifier] || 0
          : 0;
        const targetSignature = target?.frontend?.entry
          ? `${target.frontend.entry}:${extensionListVersion}:${runtimeVersion}`
          : undefined;

        if (!target || active.signature !== targetSignature) {
          deactivateExtension(identifier);
        }
      }

      for (const extension of targets) {
        if (cancelled) break;

        const signature = `${extension.frontend?.entry}:${extensionListVersion}:${extensionRuntimeVersionMap[extension.identifier] || 0}`;
        if (
          activeExtensionsRef.current[extension.identifier]?.signature ===
            signature ||
          activatingExtensionsRef.current[extension.identifier] === signature
        ) {
          continue;
        }

        try {
          activatingExtensionsRef.current[extension.identifier] = signature;
          await activateExtension(extension, signature);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message ===
              `Extension ${extension.identifier} activation cancelled`
          ) {
            continue;
          }

          logger.error(
            `Failed to activate extension ${extension.identifier}`,
            error
          );
          toast({
            title: t("ExtensionHostContextProvider.toast.activateError", {
              name: extension.name,
            }),
            description: String(error),
            status: "error",
          });
        } finally {
          if (
            activatingExtensionsRef.current[extension.identifier] === signature
          ) {
            delete activatingExtensionsRef.current[extension.identifier];
          }
        }
      }

      if (!cancelled) {
        for (const identifier of Object.keys(activeExtensionsRef.current)) {
          if (!targetIds.has(identifier)) {
            deactivateExtension(identifier);
          }
        }
      }
    };

    syncRuntime();

    return () => {
      cancelled = true;
    };
  }, [
    activateExtension,
    deactivateExtension,
    enabledExtensionList,
    extensionListVersion,
    extensionRuntimeVersionMap,
    toast,
  ]);

  // Deactivate all active extensions on provider unmount to avoid leaks.
  useEffect(() => {
    const activeExtensions = activeExtensionsRef.current;

    return () => {
      Object.keys(activeExtensions).forEach((identifier) => {
        deactivateExtension(identifier);
      });
    };
  }, [deactivateExtension]);

  const contextValue = useMemo<ExtensionHostContextType>(
    () => ({
      data: {
        config,
        selectedPlayer,
        selectedInstance,
        playerList,
        instanceList,
      },
      actions: undefined, // will be created per-extension
      stateStore: {
        getValue: getExtensionStateValue,
        setValue: setExtensionStateValue,
        subscribe: subscribeExtensionState,
      },
      extensionList,
      enabledExtensionList,
      homeWidgets,
      getExtensionSettingsPage,
      getExtensionList,
    }),
    [
      config,
      selectedPlayer,
      selectedInstance,
      playerList,
      instanceList,
      getExtensionStateValue,
      setExtensionStateValue,
      subscribeExtensionState,
      extensionList,
      enabledExtensionList,
      homeWidgets,
      getExtensionSettingsPage,
      getExtensionList,
    ]
  );

  return (
    <ExtensionHostContext.Provider value={contextValue}>
      {children}
    </ExtensionHostContext.Provider>
  );
};

export const useExtensionHost = (): ExtensionHostContextType => {
  const context = useContext(ExtensionHostContext);
  if (!context) {
    throw new Error(
      "useExtensionHost must be used within a ExtensionHostContextProvider"
    );
  }
  return context;
};

// export const useExtensionHostState = <T,>(
//   scope: string,
//   key: string,
//   initialValue: T
// ) => {
//   const { stateStore } = useExtensionHost();
//   const initialRef = useRef(initialValue);

//   const value = useSyncExternalStore(
//     (listener) => stateStore.subscribe(scope, key, listener),
//     () => stateStore.getValue(scope, key, initialRef.current),
//     () => initialRef.current
//   );

//   const setValue = useCallback(
//     (nextValue: React.SetStateAction<T>) => {
//       stateStore.setValue(scope, key, nextValue, initialRef.current);
//     },
//     [key, scope, stateStore]
//   );

//   return [value, setValue] as const;
// };

declare global {
  interface Window {
    registerExtension?: ExtensionRegistrationFunction;
  }
}

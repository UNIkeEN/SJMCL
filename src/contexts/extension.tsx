import * as ChakraUI from "@chakra-ui/react";
import { convertFileSrc, invoke as tauriInvoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
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
} from "@/models/extension";
import { ExtensionService } from "@/services/extension";

interface ExtensionContextRegistration {
  homeWidget?: ExtensionHomeWidgetDefinition;
  dispose?: () => void;
}

interface ExtensionContextRegistrationApi {
  React: typeof React;
  ChakraUI: typeof ChakraUI;
  identifier: string;
  useHostContext: () => ExtensionAbility;
}

type ExtensionContextFactory = (
  api: ExtensionContextRegistrationApi
) => ExtensionContextRegistration | void;

interface ActiveExtensionRecord {
  dispose?: () => void;
  scriptElement?: HTMLScriptElement;
  signature: string;
}

interface PendingRegistration {
  identifier: string;
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
  actions: ExtensionAbilityActions;
  stateStore: ExtensionHostStoreState;
  // extension runtime registry state managed by host.
  extensionList: ExtensionInfo[] | undefined;
  enabledExtensionList: ExtensionInfo[] | undefined;
  homeWidgets: ExtensionHomeWidgetContribution[];
  // host control methods.
  getExtensionList: (sync?: boolean) => ExtensionInfo[] | undefined;
}

const ExtensionHostContext = createContext<
  ExtensionHostContextType | undefined
>(undefined);

// sanitize extension frontend entry path and block absolute/".." traversal.
const sanitizeEntryPath = (entry: string) => {
  const normalized = entry.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("..")) {
    return undefined;
  }
  return normalized;
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
 *    script and waits for `window.registerExtension(factory)` handshake.
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
  const [playerList, setPlayerList] = useState<
    ExtensionAbilityData["playerList"]
  >([]);
  const [instanceList, setInstanceList] = useState<
    ExtensionAbilityData["instanceList"]
  >([]);

  const [homeWidgetMap, setHomeWidgetMap] = useState<
    Record<string, ExtensionHomeWidgetContribution>
  >({});

  // pending registration, active extensions, and per-extension state stores/listeners.
  const pendingRegistrationRef = useRef<PendingRegistration | null>(null);
  const activeExtensionsRef = useRef<Record<string, ActiveExtensionRecord>>({});
  const extensionStateStoreRef = useRef<ExtensionStateStore>({});
  const extensionStateListenerRef = useRef<
    Record<string, Record<string, Set<() => void>>>
  >({});

  const invoke = useCallback<ExtensionAbility["actions"]["invoke"]>(
    async <T,>(command: string, payload?: Record<string, unknown>) => {
      return await tauriInvoke<T>(command, payload);
    },
    []
  );

  const requestText = useCallback<ExtensionAbility["actions"]["requestText"]>(
    async (url: string, init?: RequestInit, encoding = "utf-8") => {
      const response = await tauriFetch(url, init as any);
      const buffer = await response.arrayBuffer();
      return new TextDecoder(encoding).decode(buffer);
    },
    []
  );

  // compose host actions exposed to extensions.
  const extensionActions = useMemo<ExtensionAbilityActions>(
    () => ({
      getPlayerList,
      getInstanceList,
      updateConfig: update,
      invoke,
      requestText,
      openSharedModal,
    }),
    [
      getPlayerList,
      getInstanceList,
      update,
      invoke,
      requestText,
      openSharedModal,
    ]
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

  const extensionActionsRef = useRef<ExtensionAbilityActions>(extensionActions);
  extensionActionsRef.current = extensionActions;

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

  // 中文：注册全局入口 window.registerExtension，接收扩展工厂函数。
  // EN: Register global window.registerExtension entry to receive extension factory.
  useEffect(() => {
    const registerExtension = (factory: ExtensionContextFactory) => {
      const pending = pendingRegistrationRef.current;
      if (!pending) {
        logger.error("Received extension registration without pending loader");
        return;
      }
      pending.resolve(factory);
      pendingRegistrationRef.current = null;
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
      return Object.values(homeWidgetMap);
    }

    return enabledExtensionList
      .map((extension) => homeWidgetMap[extension.identifier])
      .filter(Boolean);
  }, [enabledExtensionList, homeWidgetMap]);

  const removeExtensionContributionState = useCallback((identifier: string) => {
    setHomeWidgetMap((prev) => {
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

  // EN: Build host context object injected into extension instance.
  const createExtensionContextValue = useCallback(
    (identifier: string): ExtensionAbility => ({
      data: {
        ...extensionDataRef.current,
        routeQuery: parseRouteQuery(),
      },
      actions: extensionActionsRef.current,
      state: {
        useExtensionState: createUseExtensionState(identifier),
      },
    }),
    [createUseExtensionState]
  );

  // build extension script URL (user dir + entry + cache-busting query).
  const getScriptUrl = useCallback(
    async (extension: ExtensionInfo, nonce: string) => {
      const entry = sanitizeEntryPath(extension.frontend?.entry || "");
      if (!entry) {
        throw new Error(
          `Invalid frontend entry for extension ${extension.identifier}`
        );
      }

      const base = await appDataDir();
      const fullPath = await join(
        base,
        "UserContent",
        "Extensions",
        extension.identifier,
        entry
      );

      return `${convertFileSrc(fullPath)}?extension=${encodeURIComponent(extension.identifier)}&v=${nonce}`;
    },
    []
  );

  // inject script and wait for extension to call registerExtension with factory.
  const loadExtensionFactory = useCallback(
    async (extension: ExtensionInfo, signature: string) => {
      const scriptUrl = await getScriptUrl(extension, signature);

      return await new Promise<{
        factory: ExtensionContextFactory;
        scriptElement: HTMLScriptElement;
      }>((resolve, reject) => {
        let settled = false;
        const scriptElement = document.createElement("script");
        scriptElement.src = scriptUrl;
        scriptElement.async = false;
        scriptElement.dataset.extensionIdentifier = extension.identifier;

        pendingRegistrationRef.current = {
          identifier: extension.identifier,
          resolve: (factory) => {
            if (settled) return;
            settled = true;
            resolve({ factory, scriptElement });
          },
          reject: (error) => {
            if (settled) return;
            settled = true;
            reject(error);
          },
        };

        scriptElement.onload = () => {
          window.setTimeout(() => {
            if (!settled) {
              settled = true;
              pendingRegistrationRef.current = null;
              reject(
                new Error(
                  `Extension ${extension.identifier} did not call registerExtension`
                )
              );
            }
          }, 0);
        };

        scriptElement.onerror = () => {
          if (settled) return;
          settled = true;
          pendingRegistrationRef.current = null;
          reject(
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
        identifier: extension.identifier,
        useHostContext: () => createExtensionContextValue(extension.identifier),
      };

      const registration = (factory(api) || {}) as ExtensionContextRegistration;

      if (registration.homeWidget) {
        const homeWidget = registration.homeWidget;
        setHomeWidgetMap((prev) => ({
          ...prev,
          [extension.identifier]: {
            ...homeWidget,
            identifier: extension.identifier,
            extension,
          },
        }));
      } else {
        setHomeWidgetMap((prev) => {
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
    [createExtensionContextValue, loadExtensionFactory]
  );

  const deactivateExtension = useCallback(
    (identifier: string) => {
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
        const targetSignature = target?.frontend?.entry
          ? `${target.frontend.entry}:${extensionListVersion}`
          : undefined;

        if (!target || active.signature !== targetSignature) {
          deactivateExtension(identifier);
        }
      }

      for (const extension of targets) {
        if (cancelled) break;

        const signature = `${extension.frontend?.entry}:${extensionListVersion}`;
        if (
          activeExtensionsRef.current[extension.identifier]?.signature ===
          signature
        ) {
          continue;
        }

        try {
          await activateExtension(extension, signature);
        } catch (error) {
          logger.error(
            `Failed to activate extension ${extension.identifier}`,
            error
          );
          toast({
            title: `Failed to activate extension ${extension.name}`,
            description: String(error),
            status: "error",
          });
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
      actions: extensionActions,
      stateStore: {
        getValue: getExtensionStateValue,
        setValue: setExtensionStateValue,
        subscribe: subscribeExtensionState,
      },
      extensionList,
      enabledExtensionList,
      homeWidgets,
      getExtensionList,
    }),
    [
      config,
      selectedPlayer,
      selectedInstance,
      playerList,
      instanceList,
      extensionActions,
      getExtensionStateValue,
      setExtensionStateValue,
      subscribeExtensionState,
      extensionList,
      enabledExtensionList,
      homeWidgets,
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

declare global {
  interface Window {
    registerExtension?: (factory: ExtensionContextFactory) => void;
  }
}

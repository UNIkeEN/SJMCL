import * as ChakraUI from "@chakra-ui/react";
import { convertFileSrc, invoke as tauriInvoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { openUrl } from "@tauri-apps/plugin-opener";
import { t } from "i18next";
import { useRouter } from "next/router";
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
  ExtensionAbilityActions,
  ExtensionAbilityApi,
  ExtensionAbilityData,
  ExtensionAbilityState,
  ExtensionHomeWidgetContribution,
  ExtensionHomeWidgetDefinition,
  ExtensionInfo,
  ExtensionPageContribution,
  ExtensionPageDefinition,
  ExtensionSettingsPageContribution,
  ExtensionSettingsPageDefinition,
} from "@/models/extension";
import { TaskTypeEnums } from "@/models/task";
import { ExtensionService } from "@/services/extension";
import { TaskService } from "@/services/task";
import { UtilsService } from "@/services/utils";
import { logger } from "@/utils/logging";
import { sanitizeFileName } from "@/utils/string";
import { createWindow } from "@/utils/window";
import { buildProxiedExtensionScript } from "./proxy";

interface ExtensionContextRegistration {
  homeWidget?: ExtensionHomeWidgetDefinition;
  homeWidgets?: ExtensionHomeWidgetDefinition[];
  settingsPage?: ExtensionSettingsPageDefinition;
  page?: ExtensionPageDefinition;
  pages?: ExtensionPageDefinition[];
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
  getHostContext: () => ExtensionAbilityApi;
  useHostData: () => ExtensionAbilityData;
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

interface ExtensionHostActionRefs {
  getPlayerList: (
    sync?: boolean
  ) => ExtensionAbilityData["playerList"] | undefined;
  getInstanceList: (
    sync?: boolean
  ) => ExtensionAbilityData["instanceList"] | undefined;
  updateConfig: (path: string, value: any) => void;
  openSharedModal: (key: string, params?: any) => void;
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
  getExtensionPage: (
    identifier: string,
    routePath: string,
    isStandAlone?: boolean
  ) => ExtensionPageContribution | undefined;
  // host control methods.
  getExtensionList: (sync?: boolean) => ExtensionInfo[] | undefined;
}

const ExtensionHostContext = createContext<
  ExtensionHostContextType | undefined
>(undefined);

export const normalizeExtensionRelativePath = (
  path: string | string[] | undefined
) => {
  const rawPath = Array.isArray(path) ? path.join("/") : path;
  const normalized = rawPath
    ?.replace(/[\\/]+/g, "/")
    .trim()
    .replace(/^\/+|\/+$/g, "");

  if (!normalized || normalized.includes("..")) {
    return undefined;
  }

  return normalized;
};

const stripParentPathSegments = (route: string) =>
  route.replace(
    /^[^?#]*/,
    (pathname) =>
      pathname
        .split("/")
        .filter((segment) => segment !== "..")
        .join("/") || "/"
  );

// standalone extension page uses query params due to Next.js static export limits.
export const convertExtensionRouteForStandalone = (route: string) => {
  if (!route.startsWith("/standalone/extension/")) {
    return route;
  }

  const url = new URL(route, "https://launcher.local");
  const extensionRoute = url.pathname.slice("/standalone/extension/".length);
  const routeSegments = extensionRoute.split("/");
  const identifier = routeSegments.shift();
  const normalizedRoutePath = normalizeExtensionRelativePath(
    routeSegments.join("/")
  );
  if (!identifier || !normalizedRoutePath) {
    return route;
  }

  const searchParams = new URLSearchParams({
    identifier,
    routePath: `${normalizedRoutePath}${url.search}`,
  });
  return `/standalone/extension?${searchParams.toString()}`;
};

export const createStandaloneExtensionRouteUrl = (
  routePath: string | string[] | undefined
) => {
  const rawRoutePath = Array.isArray(routePath) ? routePath[0] : routePath;
  const normalizedRoutePath = rawRoutePath
    ?.replace(/\\/g, "/")
    .trim()
    .replace(/^\/+/, "");
  return new URL(
    stripParentPathSegments(
      normalizedRoutePath ? `/${normalizedRoutePath}` : "/"
    ),
    "https://launcher.local"
  );
};

const isInternalLauncherRoute = (route: string) => {
  return (
    !!route &&
    !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(route) &&
    !route.startsWith("//")
  );
};

const resolveExtensionNavigationRoute = (
  extension: ExtensionInfo,
  route: string,
  isToStandalone: boolean // true if navigating from main window to standalone window, false for other cases
) => {
  const trimmedRoute = route.trim().replace(/\\/g, "/");
  const internalRoute = stripParentPathSegments(
    trimmedRoute.startsWith("/") ? trimmedRoute : `/${trimmedRoute}`
  );

  const isCurrentStandalonePage =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/standalone/");

  const isValid = !(
    !isInternalLauncherRoute(trimmedRoute) ||
    (isToStandalone
      ? !internalRoute.startsWith("/standalone/")
      : isCurrentStandalonePage
        ? !internalRoute.startsWith("/standalone/")
        : internalRoute.startsWith("/standalone/")) ||
    (internalRoute.startsWith("/settings/extension/") &&
      !internalRoute.startsWith(
        `/settings/extension/${extension.identifier}`
      )) ||
    (internalRoute.startsWith("/extension/") &&
      !internalRoute.startsWith(`/extension/${extension.identifier}`)) ||
    (internalRoute.startsWith("/standalone/extension/") &&
      !internalRoute.startsWith(
        `/standalone/extension/${extension.identifier}`
      )) ||
    (internalRoute.startsWith("/standalone/extension?") &&
      !internalRoute.startsWith(
        `/standalone/extension?identifier=${encodeURIComponent(extension.identifier)}`
      ))
  );

  if (!isValid) {
    return undefined;
  }
  return convertExtensionRouteForStandalone(internalRoute);
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

  const url = new URL(window.location.href);
  const searchParams =
    url.pathname === "/standalone/extension"
      ? createStandaloneExtensionRouteUrl(
          url.searchParams.get("routePath") || undefined
        ).searchParams
      : url.searchParams;
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
 * 1) The host loads installed extension metadata from backend and filters the
 *    enabled subset from launcher config.
 * 2) For each enabled extension with a frontend entry, the host injects its
 *    script and waits for `window.registerExtension(...)` to provide a factory.
 * 3) The factory runs against a constrained host API surface
 *    (React/Chakra + stable actions/state + launcher-owned reactive data).
 * 4) Returned registrations are normalized into runtime contributions
 *    (home widgets, settings page, general pages) keyed by extension identifier.
 * 6) A sync loop re-evaluates activation signatures and performs reload/teardown
 *    to keep runtime state aligned with extension list and config changes.
 *
 * Design note:
 * - `getHostContext()` returns a stable per-extension API object for actions/state.
 * - `useHostData()` is the reactive entry for launcher-owned data snapshots.
 * - Standalone extension pages are opened through the fixed
 *    `/standalone/extension` route with `identifier` and `routePath` query
 *    params so release builds still work under Next.js static export.
 */
export const ExtensionHostContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const router = useRouter();
  const { config, update } = useLauncherConfig();
  const { selectedPlayer, selectedInstance, getPlayerList, getInstanceList } =
    useGlobalData();
  const { openSharedModal, openGenericConfirmDialog } = useSharedModals();
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
  const [pageMap, setPageMap] = useState<
    Record<string, ExtensionPageContribution[]>
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

  const extensionHostContextRef = useRef<Record<string, ExtensionAbilityApi>>(
    {}
  );
  const hostDataSnapshotRef = useRef<ExtensionAbilityData>({
    config,
    selectedPlayer,
    selectedInstance,
    playerList,
    instanceList,
    routeQuery: parseRouteQuery(),
  });
  const hostDataListenersRef = useRef<Set<() => void>>(new Set());
  const hostActionRefs = useRef<ExtensionHostActionRefs>({
    getPlayerList,
    getInstanceList,
    updateConfig: update,
    openSharedModal,
  });

  const invoke = useCallback<ExtensionAbilityActions["invoke"]>(
    async <T,>(command: string, payload?: Record<string, unknown>) => {
      if (
        [
          "delete_file",
          "delete_directory",
          "read_file",
          "write_file",
          "schedule_progressive_task_group",
          "add_extension",
          "delete_extension",
        ].includes(command)
      ) {
        throw new Error(`Direct invoke is not allowed for ${command}`);
      }

      return await tauriInvoke<T>(command, payload);
    },
    []
  );

  const request = useCallback<ExtensionAbilityActions["request"]>(
    async (input: URL | Request | string, init?: RequestInit) => {
      return await tauriFetch(input, init);
    },
    []
  );

  const requestText = useCallback<ExtensionAbilityActions["requestText"]>(
    async (url: string, init?: RequestInit, encoding?: string) => {
      const response = await request(url, init);
      if (!encoding || /^(utf-?8)$/i.test(encoding))
        return await response.text();
      return new TextDecoder(encoding).decode(await response.arrayBuffer());
    },
    [request]
  );

  const navigate = useCallback(
    async (extension: ExtensionInfo, route: string) => {
      const nextRoute = resolveExtensionNavigationRoute(
        extension,
        route,
        false
      );
      if (!nextRoute) {
        throw new Error(`Invalid route: ${route}`);
      }

      await router.push(nextRoute);
    },
    [router]
  );

  const openWindow = useCallback(
    (extension: ExtensionInfo, route: string, title: string) => {
      const nextRoute = resolveExtensionNavigationRoute(extension, route, true);
      if (!nextRoute) {
        throw new Error(`Invalid route: ${route}`);
      }

      createWindow(`extension_standalone_${Date.now()}`, nextRoute, {
        title: `${title} - ${extension.name}`,
      });
    },
    []
  );

  const openExternalLink = useCallback(
    async (extension: ExtensionInfo, url: string) => {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        throw new Error("Invalid external link");
      }

      await new Promise<void>((resolve, reject) => {
        openGenericConfirmDialog({
          title: t("ExtensionOpenExternalLinkConfirmDialog.title"),
          body: t("ExtensionOpenExternalLinkConfirmDialog.body", {
            extension: extension.name,
            link: trimmedUrl,
          }),
          btnOK: t("ExtensionOpenExternalLinkConfirmDialog.button.open"),
          btnCancel: t("General.cancel"),
          onOKCallback: async () => {
            try {
              logger.info(
                `Extension ${extension.identifier} is opening external link: ${trimmedUrl}`
              );
              await openUrl(trimmedUrl);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          onCancelCallback: () => reject(new Error("Cancelled")),
        });
      });
    },
    [openGenericConfirmDialog]
  );

  const scheduleExtensionUpdate = useCallback(
    async (extension: ExtensionInfo, src: string, newVersion: string) => {
      const normalizedSrc = src.trim();
      const normalizedVersion = newVersion.trim();
      const cacheDir = config.download.cache.directory.trim();

      if (!normalizedSrc || !normalizedVersion || !cacheDir) {
        throw new Error("Invalid extension update arguments");
      }

      const filename = sanitizeFileName(
        `${extension.identifier}_${normalizedVersion}.sjmclx`
      );
      const response = await TaskService.scheduleProgressiveTaskGroup(
        `extension-update?${extension.identifier}&${normalizedVersion}`,
        [
          {
            taskType: TaskTypeEnums.Download,
            src: normalizedSrc,
            dest: await join(cacheDir, filename),
            filename,
          },
        ]
      );

      if (response.status !== "success") {
        throw response.raw_error || response.details || response.message;
      }
    },
    [config.download.cache.directory]
  );

  useEffect(() => {
    hostActionRefs.current = {
      getPlayerList,
      getInstanceList,
      updateConfig: update,
      openSharedModal,
    };
  }, [getInstanceList, getPlayerList, openSharedModal, update]);

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

  // refresh trigger
  useEffect(() => {
    const unlisten = ExtensionService.onExtensionRefresh(() => {
      handleRetrieveExtensionList();
    });
    return () => {
      unlisten();
    };
  }, [handleRetrieveExtensionList]);

  useEffect(() => {
    setPlayerList(getPlayerList() || []);
  }, [getPlayerList]);

  useEffect(() => {
    setInstanceList(getInstanceList() || []);
  }, [getInstanceList]);

  // Host data management with useSyncExternalStore to trigger updates in extensions.
  const subscribeHostData = useCallback((listener: () => void) => {
    hostDataListenersRef.current.add(listener);
    return () => {
      hostDataListenersRef.current.delete(listener);
    };
  }, []);

  const getHostDataSnapshot = useCallback(
    () => hostDataSnapshotRef.current,
    []
  );

  const useHostData = useMemo(
    () =>
      function useHostData() {
        return useSyncExternalStore(
          subscribeHostData,
          getHostDataSnapshot,
          getHostDataSnapshot
        );
      },
    [getHostDataSnapshot, subscribeHostData]
  );

  useEffect(() => {
    hostDataSnapshotRef.current = {
      config,
      selectedPlayer,
      selectedInstance,
      playerList,
      instanceList,
      routeQuery: parseRouteQuery(),
    };

    hostDataListenersRef.current.forEach((listener) => {
      listener();
    });
  }, [
    config,
    instanceList,
    playerList,
    router.asPath,
    selectedInstance,
    selectedPlayer,
  ]);

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

  const getExtensionPage = useCallback(
    (identifier: string, routePath: string, isStandAlone = false) => {
      const normalizedRoutePath = normalizeExtensionRelativePath(routePath);
      if (!normalizedRoutePath) {
        return undefined;
      }

      return pageMap[identifier]?.find(
        (page) =>
          page.routePath === normalizedRoutePath &&
          !!page.isStandAlone === isStandAlone
      );
    },
    [pageMap]
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
    setPageMap((prev) => {
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
      const relativePath = normalizeExtensionRelativePath(path);
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
      getPlayerList: (sync) => hostActionRefs.current.getPlayerList(sync),
      getInstanceList: (sync) => hostActionRefs.current.getInstanceList(sync),
      updateConfig: (path, value) =>
        hostActionRefs.current.updateConfig(path, value),
      navigate: async (route: string) => await navigate(extension, route),
      navBack: () => router.back(),
      openWindow: (route: string, title: string) =>
        openWindow(extension, route, title),
      openExternalLink: async (url: string) =>
        await openExternalLink(extension, url),
      openSharedModal: (key, params) =>
        hostActionRefs.current.openSharedModal(key, params),
      request,
      requestText,
      invoke,
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
      logger,
      reloadSelf: () =>
        setExtensionRuntimeVersionMap((previous) => ({
          ...previous,
          [extension.identifier]: (previous[extension.identifier] || 0) + 1,
        })),
      updateSelf: async (src: string, newVersion: string) =>
        await scheduleExtensionUpdate(extension, src, newVersion),
    }),
    [
      invoke,
      navigate,
      openExternalLink,
      openWindow,
      router,
      request,
      requestText,
      runExtensionFileCommand,
      scheduleExtensionUpdate,
    ]
  );

  // build a stable host context object injected into an extension instance.
  const getExtensionHostContext = useCallback(
    (extension: ExtensionInfo): ExtensionAbilityApi => {
      const cached = extensionHostContextRef.current[extension.identifier];
      if (cached) {
        return cached;
      }

      const contextValue: ExtensionAbilityApi = {
        actions: createExtensionActions(extension),
        state: {
          useExtensionState: createUseExtensionState(extension.identifier),
        },
      };

      extensionHostContextRef.current[extension.identifier] = contextValue;
      return contextValue;
    },
    [createExtensionActions, createUseExtensionState]
  );

  // build extension script URL (extension dir + entry + cache-busting query).
  const getScriptUrl = useCallback(
    async (extension: ExtensionInfo, nonce: string, token: string) => {
      const entry = normalizeExtensionRelativePath(extension.frontend?.entry);
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
    const relativePath = normalizeExtensionRelativePath(path);
    if (!relativePath) {
      throw new Error(`Invalid extension asset path: ${path}`);
    }

    return convertFileSrc(
      `${extension.path.replace(/[\\/]+/g, "/").replace(/\/+$/, "")}/${relativePath}`
    );
  }, []);

  // inject script through a proxied runtime and wait for the extension to register.
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

        fetch(scriptUrl)
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(
                `Failed to fetch script for ${extension.identifier}`
              );
            }
            // execute the extension code through proxied window/document globals.
            scriptElement.text = buildProxiedExtensionScript(
              await response.text()
            );
            Object.defineProperty(document, "currentScript", {
              configurable: true,
              get: () => scriptElement,
            });

            try {
              document.body.appendChild(scriptElement);
            } finally {
              Reflect.deleteProperty(document, "currentScript");
            }
          })
          .catch((error) => {
            rejectWithCleanup(error);
          });
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
        getHostContext: () => getExtensionHostContext(extension),
        useHostData,
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
                  ? `${extension.identifier}:home_widget`
                  : `${extension.identifier}:home_widget:${homeWidget.key || index}`,
              resetKey: `${extension.identifier}:${signature}:home_widget:${homeWidget.key || index}`,
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

      const pageDefinitions = [
        ...(registration.page ? [registration.page] : []),
        ...(registration.pages || []),
      ];

      if (pageDefinitions.length > 0) {
        const pages = pageDefinitions.flatMap((page, index) => {
          const normalizedRoutePath = normalizeExtensionRelativePath(
            page.routePath
          );
          if (!normalizedRoutePath) {
            logger.error(
              `Invalid page route path for extension ${extension.identifier}: ${page.routePath}`
            );
            return [];
          }
          return [
            {
              ...page,
              routePath: normalizedRoutePath,
              isStandAlone: page.isStandAlone ?? false,
              identifier: extension.identifier,
              resetKey: `${extension.identifier}:${signature}:page:${page.isStandAlone ? "standalone:" : ""}${normalizedRoutePath}:${index}`,
              extension,
            },
          ];
        });

        if (pages.length > 0) {
          setPageMap((prev) => ({
            ...prev,
            [extension.identifier]: pages,
          }));
        } else {
          setPageMap((prev) => {
            const next = { ...prev };
            delete next[extension.identifier];
            return next;
          });
        }
      } else {
        setPageMap((prev) => {
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
    [getAssetUrl, getExtensionHostContext, loadExtensionFactory, useHostData]
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
      delete extensionHostContextRef.current[identifier];
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
      getExtensionPage,
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
      getExtensionPage,
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

import * as ChakraUI from "@chakra-ui/react";
import { convertFileSrc, invoke as tauriInvoke } from "@tauri-apps/api/core";
import {
  CheckMenuItem,
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import { join } from "@tauri-apps/api/path";
import {
  LogicalSize,
  PhysicalPosition,
  Window,
  availableMonitors,
  currentMonitor,
  getAllWindows,
  getCurrentWindow,
  primaryMonitor,
} from "@tauri-apps/api/window";
import {
  confirm as confirmDialog,
  message as messageDialog,
  open as openDialog,
} from "@tauri-apps/plugin-dialog";
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
import Editable from "@/components/common/editable";
import { FormattedMCText } from "@/components/common/formatted-mc-text";
import MarkdownContainer from "@/components/common/markdown-container";
import { MenuSelector } from "@/components/common/menu-selector";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import Segmented from "@/components/common/segmented";
import { WrapCard, WrapCardGroup } from "@/components/common/wrap-card";
import ExtensionContributionWrapper from "@/components/extension/contribution-wrapper";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { type ExtensionSlotKey, ExtensionUISlotKey } from "@/enums/extension";
import useDeepLink from "@/hooks/deep-link";
import { useGetState } from "@/hooks/get-state";
import {
  ExtensionAbilityActions,
  ExtensionAbilityApi,
  ExtensionAbilityData,
  ExtensionAbilityState,
  ExtensionContextMenuItem,
  ExtensionContributionRegistration,
  ExtensionHomeWidgetContribution,
  ExtensionImportedFile,
  ExtensionInfo,
  ExtensionModalContribution,
  ExtensionPageContribution,
  ExtensionRuntimeContext,
  ExtensionSettingsPageContribution,
  ExtensionSlotContextMap,
  ExtensionSlotContributionRegistry,
  ExtensionSlotDefinition,
  ExtensionSlotItemMap,
  ExtensionSlotRegistry,
} from "@/models/extension";
import { TaskTypeEnums } from "@/models/task";
import { ConfigService } from "@/services/config";
import { ExtensionService } from "@/services/extension";
import { TaskService } from "@/services/task";
import { UtilsService } from "@/services/utils";
import { logger } from "@/utils/logging";
import { sanitizeFileName } from "@/utils/string";
import { createWindow } from "@/utils/window";
import { buildProxiedExtensionScript } from "./proxy";

interface ExtensionContextRegistration extends ExtensionContributionRegistration {
  slots?: ExtensionSlotRegistry;
  dispose?: () => void;
}

interface ExtensionContextRegistrationApi {
  React: typeof React;
  ChakraUI: typeof ChakraUI;
  Components: {
    Editable: typeof Editable;
    FormattedMCText: typeof FormattedMCText;
    MarkdownContainer: typeof MarkdownContainer;
    MenuSelector: typeof MenuSelector;
    OptionItem: typeof OptionItem;
    OptionItemGroup: typeof OptionItemGroup;
    Section: typeof Section;
    Segmented: typeof Segmented;
    WrapCard: typeof WrapCard;
    WrapCardGroup: typeof WrapCardGroup;
  };
  identifier: string;
  runtime: ExtensionRuntimeContext;
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

interface ExtensionCustomModalState {
  isOpen: boolean;
  params: any;
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
  getExtensionSlotItems: <K extends ExtensionSlotKey>(
    key: K,
    context: ExtensionSlotContextMap[K]
  ) => ExtensionSlotItemMap[K][];
  // host control methods.
  getExtensionList: (sync?: boolean) => ExtensionInfo[] | undefined;
  handleAddExtension: (path: string) => Promise<void>;
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

const EXTENSION_OVERLAY_WINDOW_PREFIX = "extension_overlay_";

const encodeWindowLabelPart = (value: string) =>
  Array.from(value.trim())
    .map((character) => character.codePointAt(0)!.toString(16))
    .join("-");

const getOverlayWindowLabel = (extensionIdentifier: string, key: string) =>
  `${EXTENSION_OVERLAY_WINDOW_PREFIX}${encodeWindowLabelPart(extensionIdentifier)}_${encodeWindowLabelPart(key)}`;

const getExtensionRuntimeContext = (): ExtensionRuntimeContext => {
  if (typeof window === "undefined") {
    return { window: { kind: "main", label: "main" } };
  }
  const label = getCurrentWindow().label;
  const isOverlay = label.startsWith(EXTENSION_OVERLAY_WINDOW_PREFIX);
  const isStandalone = window.location.pathname.startsWith("/standalone/");

  return {
    window: {
      kind: isOverlay ? "overlay" : isStandalone ? "standalone" : "main",
      label,
    },
  };
};

const addOverlayRouteFlag = (route: string) => {
  const url = new URL(route, "https://launcher.local");
  url.searchParams.set("overlay", "1");
  return `${url.pathname}${url.search}`;
};

const createNativeContextMenuItems = async (
  items: ExtensionContextMenuItem[],
  idPrefix: string,
  onSelect: (id: string) => void,
  seenIds = new Set<string>(),
  depth = 0
): Promise<Array<MenuItem | CheckMenuItem | PredefinedMenuItem | Submenu>> => {
  if (depth > 4) {
    throw new Error("Context menu nesting is too deep");
  }

  const nativeItems: Array<
    MenuItem | CheckMenuItem | PredefinedMenuItem | Submenu
  > = [];

  for (const item of items) {
    if (item.type === "separator") {
      nativeItems.push(await PredefinedMenuItem.new({ item: "Separator" }));
      continue;
    }

    const id = item.id.trim();
    if (!id || seenIds.has(id)) {
      throw new Error(`Invalid or duplicate context menu id: ${item.id}`);
    }
    seenIds.add(id);
    const nativeId = `${idPrefix}:${encodeWindowLabelPart(id)}`;

    if (item.type === "submenu") {
      nativeItems.push(
        await Submenu.new({
          id: nativeId,
          text: item.label,
          enabled: item.enabled ?? true,
          items: await createNativeContextMenuItems(
            item.items,
            idPrefix,
            onSelect,
            seenIds,
            depth + 1
          ),
        })
      );
      continue;
    }

    const options = {
      id: nativeId,
      text: item.label,
      enabled: item.enabled ?? true,
      action: () => onSelect(id),
    };
    nativeItems.push(
      item.type === "check"
        ? await CheckMenuItem.new({ ...options, checked: item.checked })
        : await MenuItem.new(options)
    );
  }

  return nativeItems;
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

  if (router.pathname === "/standalone/game-log") {
    return <>{children}</>;
  }

  return (
    <ActiveExtensionHostContextProvider>
      {children}
    </ActiveExtensionHostContextProvider>
  );
};

const ActiveExtensionHostContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const router = useRouter();
  const runtime = useMemo(() => getExtensionRuntimeContext(), []);
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
  const pageMapRef = useRef(pageMap);
  const [customModalMap, setCustomModalMap] = useState<
    Record<string, ExtensionModalContribution[]>
  >({});
  const [slotMap, setSlotMap] = useState<
    Record<string, ExtensionSlotContributionRegistry>
  >({});

  const [customModalStates, setCustomModalStates] = useState<
    Record<string, ExtensionCustomModalState>
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

  const extensionIdentifierList = useMemo(
    () =>
      new Set((extensionList || []).map((extension) => extension.identifier)),
    [extensionList]
  );

  const invoke = useCallback<ExtensionAbilityActions["invoke"]>(
    async <T,>(command: string, payload?: Record<string, unknown>) => {
      if (
        [
          "delete_file",
          "delete_directory",
          "read_file",
          "write_file",
          "create_window",
          "import_extension_file",
          "open_extension_file",
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

  const assertOwnedOverlayWindow = useCallback(
    (extension: ExtensionInfo) => {
      const expectedPrefix = `${EXTENSION_OVERLAY_WINDOW_PREFIX}${encodeWindowLabelPart(extension.identifier)}_`;
      if (
        runtime.window.kind !== "overlay" ||
        !runtime.window.label.startsWith(expectedPrefix)
      ) {
        throw new Error(
          "This action is only available in the extension's overlay window"
        );
      }
      return getCurrentWindow();
    },
    [runtime]
  );

  const openOverlayWindow = useCallback(
    async (
      extension: ExtensionInfo,
      route: string,
      options: { key: string; width: number; height: number }
    ) => {
      if (runtime.window.kind !== "main") {
        throw new Error(
          "Overlay windows can only be opened from the main launcher window"
        );
      }
      if (
        hostDataSnapshotRef.current.config.basicInfo.osType.toLowerCase() !==
        "windows"
      ) {
        throw new Error(
          "Extension overlay windows are currently supported on Windows only"
        );
      }

      const key = options.key.trim();
      const width = Math.round(options.width);
      const height = Math.round(options.height);
      if (
        !/^[a-zA-Z0-9_-]+$/.test(key) ||
        key.length > 64 ||
        width < 32 ||
        height < 32
      ) {
        throw new Error("Invalid overlay window options");
      }
      if (width > 2048 || height > 2048) {
        throw new Error(
          "Overlay window dimensions must not exceed 2048 pixels"
        );
      }

      const routeUrl = new URL(
        stripParentPathSegments(route.trim().replace(/\\/g, "/")),
        "https://launcher.local"
      );
      const routePrefix = `/standalone/extension/${extension.identifier}/`;
      const routePath = normalizeExtensionRelativePath(
        routeUrl.pathname.startsWith(routePrefix)
          ? routeUrl.pathname.slice(routePrefix.length)
          : undefined
      );
      const ownsRoute = pageMapRef.current[extension.identifier]?.some(
        (page) => page.isStandAlone && page.routePath === routePath
      );
      const nextRoute = ownsRoute
        ? resolveExtensionNavigationRoute(extension, route, true)
        : undefined;
      if (!nextRoute) {
        throw new Error(`Invalid overlay route: ${route}`);
      }

      const label = getOverlayWindowLabel(extension.identifier, key);
      const existing = await Window.getByLabel(label);
      if (existing) {
        await existing.show();
        return;
      }

      const monitor = await currentMonitor();
      const scaleFactor = monitor?.scaleFactor || 1;
      const workArea = monitor?.workArea;
      const x = workArea
        ? (workArea.position.x + workArea.size.width) / scaleFactor - width - 24
        : undefined;
      const y = workArea
        ? (workArea.position.y + workArea.size.height) / scaleFactor -
          height -
          24
        : undefined;

      const response = await UtilsService.createWindow(
        {
          label,
          url: addOverlayRouteFlag(nextRoute),
          title: extension.name,
          width,
          height,
          x,
          y,
          transparent: true,
          decorations: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          shadow: false,
          resizable: false,
          maximizable: false,
          minimizable: false,
          fullscreen: false,
          focus: false,
          visible: false,
          preventOverflow: { width: 24, height: 24 },
          dragDropEnabled: false,
        },
        false
      );
      if (response.status === "error") {
        throw response.raw_error || response.details || response.message;
      }
    },
    [runtime]
  );

  const closeExtensionOverlayWindows = useCallback(
    async (identifier: string) => {
      const prefix = `${EXTENSION_OVERLAY_WINDOW_PREFIX}${encodeWindowLabelPart(identifier)}_`;
      const windows = await getAllWindows();
      await Promise.all(
        windows
          .filter((window) => window.label.startsWith(prefix))
          .map((window) => window.close().catch(() => undefined))
      );
    },
    []
  );

  const showCurrentWindow = useCallback(
    async (extension: ExtensionInfo) => {
      const currentWindow = assertOwnedOverlayWindow(extension);
      const [position, size, monitors] = await Promise.all([
        currentWindow.outerPosition(),
        currentWindow.outerSize(),
        availableMonitors(),
      ]);
      const minimumVisiblePixels = 32;
      const isVisible = monitors.some((monitor) => {
        const workArea = monitor.workArea;
        return (
          position.x + size.width >=
            workArea.position.x + minimumVisiblePixels &&
          position.x <=
            workArea.position.x + workArea.size.width - minimumVisiblePixels &&
          position.y + size.height >=
            workArea.position.y + minimumVisiblePixels &&
          position.y <=
            workArea.position.y + workArea.size.height - minimumVisiblePixels
        );
      });
      if (!isVisible) {
        const monitor = (await primaryMonitor()) ?? monitors[0];
        if (monitor) {
          const margin = Math.round(24 * monitor.scaleFactor);
          await currentWindow.setPosition(
            new PhysicalPosition(
              monitor.workArea.position.x +
                monitor.workArea.size.width -
                size.width -
                margin,
              monitor.workArea.position.y +
                monitor.workArea.size.height -
                size.height -
                margin
            )
          );
        }
      }
      await currentWindow.show();
    },
    [assertOwnedOverlayWindow]
  );

  const closeCurrentWindow = useCallback(
    async (extension: ExtensionInfo) => {
      await assertOwnedOverlayWindow(extension).close();
    },
    [assertOwnedOverlayWindow]
  );

  const startDraggingCurrentWindow = useCallback(
    async (extension: ExtensionInfo) => {
      await assertOwnedOverlayWindow(extension).startDragging();
    },
    [assertOwnedOverlayWindow]
  );

  const resizeCurrentWindow = useCallback(
    async (
      extension: ExtensionInfo,
      options: {
        width: number;
        height: number;
        anchor?: "topLeft" | "bottomLeft";
      }
    ) => {
      const currentWindow = assertOwnedOverlayWindow(extension);
      const width = Math.round(options.width);
      const height = Math.round(options.height);
      if (width < 32 || height < 32 || width > 2048 || height > 2048) {
        throw new Error(
          "Overlay window dimensions must be between 32 and 2048 pixels"
        );
      }

      if (options.anchor === "bottomLeft") {
        const [position, size, scaleFactor] = await Promise.all([
          currentWindow.outerPosition(),
          currentWindow.outerSize(),
          currentWindow.scaleFactor(),
        ]);
        await currentWindow.setSize(new LogicalSize(width, height));
        const nextHeight = Math.round(height * scaleFactor);
        await currentWindow.setPosition(
          new PhysicalPosition(
            position.x,
            position.y + size.height - nextHeight
          )
        );
        return;
      }

      await currentWindow.setSize(new LogicalSize(width, height));
    },
    [assertOwnedOverlayWindow]
  );

  const resetCurrentWindowPosition = useCallback(
    async (extension: ExtensionInfo) => {
      const currentWindow = assertOwnedOverlayWindow(extension);
      const [current, primary, size] = await Promise.all([
        currentMonitor(),
        primaryMonitor(),
        currentWindow.outerSize(),
      ]);
      const monitor = current ?? primary;
      if (!monitor) return;
      const margin = Math.round(24 * monitor.scaleFactor);
      await currentWindow.setPosition(
        new PhysicalPosition(
          monitor.workArea.position.x +
            monitor.workArea.size.width -
            size.width -
            margin,
          monitor.workArea.position.y +
            monitor.workArea.size.height -
            size.height -
            margin
        )
      );
    },
    [assertOwnedOverlayWindow]
  );

  const showContextMenu = useCallback(
    async (extension: ExtensionInfo, items: ExtensionContextMenuItem[]) => {
      const currentWindow = assertOwnedOverlayWindow(extension);
      const countItems = (values: ExtensionContextMenuItem[]): number =>
        values.reduce(
          (count, item) =>
            count + 1 + (item.type === "submenu" ? countItems(item.items) : 0),
          0
        );
      if (items.length === 0 || countItems(items) > 100) {
        throw new Error("Context menus must contain between 1 and 100 items");
      }

      let selectedId: string | null = null;
      const nativeItems = await createNativeContextMenuItems(
        items,
        `${encodeWindowLabelPart(extension.identifier)}:${Date.now()}`,
        (id) => {
          selectedId = id;
        }
      );
      const menu = await Menu.new({ items: nativeItems });
      try {
        await menu.popup(undefined, currentWindow);
        return selectedId;
      } finally {
        await menu.close();
      }
    },
    [assertOwnedOverlayWindow]
  );

  const importFile = useCallback(
    async (
      extension: ExtensionInfo,
      options: {
        extensions: string[];
        targetPath: string;
        maxBytes: number;
      }
    ): Promise<ExtensionImportedFile | null> => {
      const extensions = options.extensions.map((value) =>
        value.trim().replace(/^\./, "").toLowerCase()
      );
      if (
        extensions.length === 0 ||
        extensions.some((value) => !/^[a-z0-9]+$/.test(value)) ||
        !Number.isSafeInteger(options.maxBytes) ||
        options.maxBytes <= 0 ||
        options.maxBytes > 256 * 1024 * 1024
      ) {
        throw new Error("Invalid file import options");
      }

      const targetPath = normalizeExtensionRelativePath(options.targetPath);
      if (!targetPath) {
        throw new Error("Invalid import target path");
      }
      const selected = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: extension.name, extensions }],
      });
      if (!selected || Array.isArray(selected)) return null;

      return await tauriInvoke<ExtensionImportedFile>("import_extension_file", {
        extensionIdentifier: extension.identifier,
        sourcePath: selected,
        targetPath,
        allowedExtensions: extensions,
        maxBytes: options.maxBytes,
      });
    },
    []
  );

  const showMessageDialog = useCallback(
    async (options: {
      title: string;
      message: string;
      kind?: "info" | "warning" | "error";
      confirm?: boolean;
      okLabel?: string;
      cancelLabel?: string;
    }) => {
      if (options.confirm) {
        return await confirmDialog(options.message, {
          title: options.title,
          kind: options.kind,
          okLabel: options.okLabel,
          cancelLabel: options.cancelLabel,
        });
      }
      await messageDialog(options.message, {
        title: options.title,
        kind: options.kind,
        okLabel: options.okLabel,
      });
      return true;
    },
    []
  );

  const openExtensionFile = useCallback(
    async (extension: ExtensionInfo, path: string) => {
      const relativePath = normalizeExtensionRelativePath(path);
      if (!relativePath || !relativePath.toLowerCase().endsWith(".txt")) {
        throw new Error("Only extension text documents can be opened");
      }
      await tauriInvoke("open_extension_file", {
        extensionIdentifier: extension.identifier,
        relativePath,
      });
    },
    []
  );

  const disableSelf = useCallback(
    async (extension: ExtensionInfo) => {
      const enabled =
        hostDataSnapshotRef.current.config.extension.enabled.filter(
          (identifier) => identifier !== extension.identifier
        );
      const response = await ConfigService.updateLauncherConfig(
        "extension.enabled",
        enabled
      );
      if (response.status === "error") {
        throw response.raw_error || response.details || response.message;
      }
      await closeExtensionOverlayWindows(extension.identifier);
    },
    [closeExtensionOverlayWindows]
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
          onCancelCallback: () => resolve(),
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

  const handleAddExtension = useCallback(
    async (path: string) => {
      const response = await ExtensionService.addExtension(path);
      if (response.status === "success") {
        getExtensionList(true);
        if (router.asPath !== "/settings/extension") {
          router.push("/settings/extension");
        }
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
    },
    [getExtensionList, router, toast]
  );

  // reload single extension
  const reloadExtension = useCallback(
    (identifier: string) =>
      setExtensionRuntimeVersionMap((previous) => ({
        ...previous,
        [identifier]: (previous[identifier] || 0) + 1,
      })),
    []
  );

  const reloadExtensionTrigger = useMemo(
    () => /^reload-extension\/?(?:\?.*)?$/,
    []
  );

  useDeepLink({
    trigger: reloadExtensionTrigger,
    onCall: useCallback(
      (path: string | URL) => {
        const identifier = new URL(path).searchParams.get("id");
        if (
          !identifier ||
          !extensionList ||
          !extensionIdentifierList.has(identifier)
        ) {
          return;
        }

        reloadExtension(identifier);
      },
      [extensionList, extensionIdentifierList, reloadExtension]
    ),
  });

  useEffect(() => {
    handleRetrieveExtensionList();
  }, [handleRetrieveExtensionList]);

  // extension list refresh trigger
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

  const handleOpenCustomModal = useCallback(
    (extension: ExtensionInfo, key: string, params?: any) => {
      const normalizedKey = key.trim();
      if (!normalizedKey || normalizedKey.includes(":")) {
        throw new Error(`Invalid custom modal key: ${key}`);
      }

      const modal = customModalMap[extension.identifier]?.find(
        (item) => item.key === normalizedKey
      );
      if (!modal) {
        logger.warn(
          `Unknown custom modal for extension ${extension.identifier}: ${key}; registered keys: ${(customModalMap[extension.identifier] || []).map((item) => item.key).join(", ")}`
        );
        throw new Error(
          `Unknown custom modal for extension ${extension.identifier}: ${key}`
        );
      }

      setCustomModalStates((prev) => ({
        ...prev,
        [modal.identifier]: {
          isOpen: true,
          params: params === undefined ? modal.params : params,
        },
      }));
    },
    [customModalMap]
  );

  const handleOpenCustomModalRef = useRef(handleOpenCustomModal);
  handleOpenCustomModalRef.current = handleOpenCustomModal;

  const getExtensionSlotItems = useCallback(
    <K extends ExtensionSlotKey>(
      key: K,
      context: ExtensionSlotContextMap[K]
    ) => {
      if (!enabledExtensionList) {
        return [];
      }

      return enabledExtensionList.flatMap((extension) => {
        try {
          return (slotMap[extension.identifier]?.[key]?.getItems(context) ||
            []) as ExtensionSlotItemMap[K][];
        } catch (error) {
          logger.error(
            `Failed to resolve extension slot ${key} for ${extension.identifier}`,
            error
          );
          return [];
        }
      });
    },
    [enabledExtensionList, slotMap]
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
      pageMapRef.current = next;
      return next;
    });
    setCustomModalMap((prev) => {
      const next = { ...prev };
      delete next[identifier];
      return next;
    });
    setSlotMap((prev) => {
      const next = { ...prev };
      delete next[identifier];
      return next;
    });
    setCustomModalStates((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(
          ([modalIdentifier]) =>
            !modalIdentifier.startsWith(`${identifier}:modal`)
        )
      )
    );

    delete extensionStateStoreRef.current[identifier];
    delete extensionStateListenerRef.current[identifier];
  }, []);

  // allow extensions to update their home widget title.
  const updateHomeWidgetTitle = useCallback(
    (extension: ExtensionInfo, title: string, key?: string) => {
      setHomeWidgetMap((prev) => {
        const widgets = prev[extension.identifier];
        if (!widgets) {
          return prev;
        }

        const targetIndex =
          widgets.length === 1
            ? 0
            : widgets.findIndex((widget) => widget.key === key);
        if (targetIndex === -1 || widgets[targetIndex].title === title) {
          return prev;
        }

        const nextWidgets = [...widgets];
        nextWidgets[targetIndex] = {
          ...nextWidgets[targetIndex],
          title,
        };

        return {
          ...prev,
          [extension.identifier]: nextWidgets,
        };
      });
    },
    []
  );

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
      openOverlayWindow: async (route, options) =>
        await openOverlayWindow(extension, route, options),
      showCurrentWindow: async () => await showCurrentWindow(extension),
      closeCurrentWindow: async () => await closeCurrentWindow(extension),
      startDraggingCurrentWindow: async () =>
        await startDraggingCurrentWindow(extension),
      resizeCurrentWindow: async (options) =>
        await resizeCurrentWindow(extension, options),
      resetCurrentWindowPosition: async () =>
        await resetCurrentWindowPosition(extension),
      showContextMenu: async (items) => await showContextMenu(extension, items),
      importFile: async (options) => await importFile(extension, options),
      showMessageDialog,
      openExtensionFile: async (path) =>
        await openExtensionFile(extension, path),
      disableSelf: async () => await disableSelf(extension),
      openExternalLink: async (url: string) =>
        await openExternalLink(extension, url),
      openSharedModal: (key, params) =>
        hostActionRefs.current.openSharedModal(key, params),
      openCustomModal: (key, params) =>
        handleOpenCustomModalRef.current(extension, key, params),
      setHomeWidgetTitle: (title, key) =>
        updateHomeWidgetTitle(extension, title, key),
      request,
      requestText,
      invoke,
      readFile: async (path: string, mode?: "string" | "base64") =>
        runExtensionFileCommand(extension, path, (fullPath) =>
          UtilsService.readFile(fullPath, mode)
        ),
      writeFile: async (
        path: string,
        content: string,
        mode?: "string" | "base64"
      ) => {
        await runExtensionFileCommand(extension, path, (fullPath) =>
          UtilsService.writeFile(fullPath, content, mode)
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
      toast,
      logger,
      reloadSelf: () => reloadExtension(extension.identifier),
      updateSelf: async (src: string, newVersion: string) =>
        await scheduleExtensionUpdate(extension, src, newVersion),
    }),
    [
      toast,
      closeCurrentWindow,
      importFile,
      invoke,
      navigate,
      openExternalLink,
      openOverlayWindow,
      openWindow,
      resetCurrentWindowPosition,
      resizeCurrentWindow,
      router,
      request,
      requestText,
      runExtensionFileCommand,
      scheduleExtensionUpdate,
      showContextMenu,
      showCurrentWindow,
      showMessageDialog,
      openExtensionFile,
      disableSelf,
      startDraggingCurrentWindow,
      updateHomeWidgetTitle,
      reloadExtension,
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

  // Skip home widget and settings page registration in standalone windows,
  // since neither is rendered outside the main window.
  const isStandalonePageRef = useRef(
    router.pathname.startsWith("/standalone/")
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
          Editable,
          FormattedMCText,
          MarkdownContainer,
          MenuSelector,
          OptionItem,
          OptionItemGroup,
          Section,
          Segmented,
          WrapCard,
          WrapCardGroup,
        },
        identifier: extension.identifier,
        runtime,
        resolveAssetUrl: (path: string) => getAssetUrl(extension, path),
        getHostContext: () => getExtensionHostContext(extension),
        useHostData,
      };

      const registration = (factory(api) || {}) as ExtensionContextRegistration;

      // Normalize extension-declared contributions into host-owned runtime maps.
      // -------- home-widget --------
      const homeWidgetDefinitions = [
        ...(registration.homeWidget ? [registration.homeWidget] : []),
        ...(registration.homeWidgets || []),
      ];

      if (!isStandalonePageRef.current && homeWidgetDefinitions.length > 0) {
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

      // ------- settings-page -------
      if (!isStandalonePageRef.current && registration.settingsPage) {
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

      // -------- custom-page --------
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
          const next = {
            ...pageMapRef.current,
            [extension.identifier]: pages,
          };
          pageMapRef.current = next;
          setPageMap(next);
        } else {
          const next = { ...pageMapRef.current };
          delete next[extension.identifier];
          pageMapRef.current = next;
          setPageMap(next);
        }
      } else {
        const next = { ...pageMapRef.current };
        delete next[extension.identifier];
        pageMapRef.current = next;
        setPageMap(next);
      }

      // ------- custom-modal -------
      const customModalDefinitions = [
        ...(registration.customModal ? [registration.customModal] : []),
        ...(registration.customModals || []),
      ];

      if (customModalDefinitions.length > 0) {
        const modalKeySet = new Set<string>();
        const modals = customModalDefinitions.flatMap((modal, index) => {
          const normalizedKey = modal.key?.trim();
          if (!normalizedKey || normalizedKey.includes(":")) {
            logger.error(
              `Invalid custom modal key for extension ${extension.identifier}: ${modal.key}`
            );
            return [];
          }

          if (modalKeySet.has(normalizedKey)) {
            logger.error(
              `Duplicate custom modal key for extension ${extension.identifier}: ${normalizedKey}`
            );
            return [];
          }

          modalKeySet.add(normalizedKey);

          return [
            {
              ...modal,
              key: normalizedKey,
              identifier:
                customModalDefinitions.length === 1
                  ? `${extension.identifier}:modal`
                  : `${extension.identifier}:modal:${normalizedKey || index}`,
              resetKey: `${extension.identifier}:${signature}:modal:${normalizedKey}:${index}`,
              extension,
            },
          ];
        });

        if (modals.length > 0) {
          setCustomModalMap((prev) => ({
            ...prev,
            [extension.identifier]: modals,
          }));
        } else {
          setCustomModalMap((prev) => {
            const next = { ...prev };
            delete next[extension.identifier];
            return next;
          });
        }
      } else {
        setCustomModalMap((prev) => {
          const next = { ...prev };
          delete next[extension.identifier];
          return next;
        });
      }

      // ------------ slots ------------
      const slotEntries = Object.entries(registration.slots || {}).filter(
        ([key]) =>
          Object.values(ExtensionUISlotKey).includes(key as ExtensionUISlotKey)
      ) as [ExtensionSlotKey, ExtensionSlotDefinition<ExtensionSlotKey>][];

      if (slotEntries.length > 0) {
        setSlotMap((prev) => ({
          ...prev,
          [extension.identifier]: Object.fromEntries(
            slotEntries.map(([key, slot], index) => [
              key,
              {
                ...slot,
                key,
                identifier: `${extension.identifier}:slot:${key}`,
                resetKey: `${extension.identifier}:${signature}:slot:${key}:${index}`,
                extension,
              },
            ])
          ),
        }));
      } else {
        setSlotMap((prev) => {
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
    [
      getAssetUrl,
      getExtensionHostContext,
      loadExtensionFactory,
      runtime,
      useHostData,
    ]
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
      void closeExtensionOverlayWindows(identifier);
    },
    [closeExtensionOverlayWindows, removeExtensionContributionState]
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
      getExtensionSlotItems,
      getExtensionList,
      handleAddExtension,
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
      getExtensionSlotItems,
      getExtensionList,
      handleAddExtension,
    ]
  );

  return (
    <ExtensionHostContext.Provider value={contextValue}>
      {children}

      {/* Extension host managed custom modal, acted like Shared Modal Context */}
      {Object.entries(customModalStates).map(
        ([modalIdentifier, modalState]) => {
          if (!modalState.isOpen) {
            return null;
          }

          const modal = Object.values(customModalMap)
            .flat()
            .find((item) => item.identifier === modalIdentifier);
          if (!modal) {
            return null;
          }

          // Exclude host-only fields so only modal props are forwarded to ChakraUI.Modal.
          const {
            Component: ModalComponent,
            extension: _extension,
            identifier: _identifier,
            key: _key,
            params: _params,
            resetKey: _resetKey,
            title,
            ...modalProps
          } = modal;

          const close = () => {
            try {
              modal.onClose?.(); // trigger extension-defined onClose callback if exists.
            } catch (error) {
              logger.error(
                `Extension custom modal onClose failed for ${modal.extension.identifier}:${modal.key}`,
                error
              );
            } finally {
              setCustomModalStates((prev) => {
                const { [modalIdentifier]: _, ...next } = prev;
                return next;
              });
            }
          };

          return (
            <ChakraUI.Modal
              {...modalProps}
              key={modal.resetKey}
              isOpen={modalState.isOpen}
              onClose={close}
            >
              <ChakraUI.ModalOverlay />
              <ChakraUI.ModalContent>
                <ChakraUI.ModalHeader>{title}</ChakraUI.ModalHeader>
                <ChakraUI.ModalCloseButton />
                <ChakraUI.ModalBody>
                  <ExtensionContributionWrapper resetKey={modal.resetKey}>
                    <ModalComponent params={modalState.params} close={close} />
                  </ExtensionContributionWrapper>
                </ChakraUI.ModalBody>
                <ChakraUI.ModalFooter justifyContent="center">
                  <ChakraUI.Text fontSize="xs" className="secondary-text">
                    {t("ExtensionHostContextProvider.extensionProvidedDialog", {
                      name: modal.extension.name,
                    })}
                  </ChakraUI.Text>
                </ChakraUI.ModalFooter>
              </ChakraUI.ModalContent>
            </ChakraUI.Modal>
          );
        }
      )}
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

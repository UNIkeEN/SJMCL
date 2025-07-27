import { useRouter } from "next/router";
import { useCallback, useMemo } from "react";
import { useSharedModals } from "@/contexts/shared-modal";
import useDeepLink from "@/hooks/deep-link";
import useDragAndDrop from "@/hooks/drag-and-drop";
import useKeyboardShortcut from "@/hooks/keyboard-shortcut";

// Handle global keyboard shortcuts, DnD events, etc.
const GlobalEventHandler: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { openSharedModal } = useSharedModals();
  const router = useRouter();
  const isStandAlone = router.pathname.startsWith("/standalone");

  const shortcutConditions = useMemo(
    () => ({
      macos: { metaKey: true, key: "s" },
      windows: { ctrlKey: true, key: "s" },
      linux: { ctrlKey: true, key: "s" },
    }),
    []
  );

  const onKeyboardShortcut = useCallback(() => {
    if (!isStandAlone) openSharedModal("spotlight-search");
  }, [isStandAlone, openSharedModal]);

  const mimeTypes = useMemo(() => ["text/plain"], []);

  const handleDragAndDrop = useCallback(
    (data: string) => {
      const prefix = "authlib-injector:yggdrasil-server:";
      if (data.startsWith(prefix)) {
        const url = data.slice(prefix.length);
        const decodeUrl = decodeURIComponent(url);
        if (!isStandAlone && decodeUrl)
          openSharedModal("add-auth-server", { presetUrl: decodeUrl });
      }
    },
    [isStandAlone, openSharedModal]
  );

  // Note: These triggers appear to be ordinary strings on the surface,
  //       but they are actually syntactic sugar for JavaScript,
  //       being parsed into RegExp objects,
  //       which can affect the `Object.is()` comparison.
  const addAuthServerTrigger = useMemo(
    () => /^add-auth-server\/?(?:\?.*)?$/,
    []
  );
  const launchTrigger = useMemo(() => /^launch\/?(?:\?.*)?$/, []);

  const handleAddAuthServer = useCallback(
    (path: string | URL) => {
      const url = new URL(path).searchParams.get("url") || "";
      const decodeUrl = decodeURIComponent(url);
      if (!isStandAlone && decodeUrl) {
        openSharedModal("add-auth-server", { presetUrl: decodeUrl });
      }
    },
    [isStandAlone, openSharedModal]
  );

  const handleLaunch = useCallback(
    (path: string | URL) => {
      const id = new URL(path).searchParams.get("id") || "";
      const decodeId = decodeURIComponent(id);
      if (!isStandAlone && decodeId) {
        // Delay the modal opening to ensure required app state/data (e.g. selected player in global-data context) is ready.
        // This is important when the app is opened via deeplink.
        // FIXME: find a better way to handle this.
        setTimeout(() => {
          openSharedModal("launch", { instanceId: decodeId });
        }, 500);
      }
    },
    [isStandAlone, openSharedModal]
  );

  useKeyboardShortcut(shortcutConditions, onKeyboardShortcut);

  useDragAndDrop({
    mimeTypes,
    onDrop: handleDragAndDrop,
  });

  useDeepLink({
    trigger: addAuthServerTrigger,
    onCall: handleAddAuthServer,
  });

  useDeepLink({
    trigger: launchTrigger,
    onCall: handleLaunch,
  });

  return <>{children}</>;
};

export default GlobalEventHandler;

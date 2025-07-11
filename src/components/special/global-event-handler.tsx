import { useRouter } from "next/router";
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

  useKeyboardShortcut(
    {
      macos: { metaKey: true, key: "s" },
      windows: { ctrlKey: true, key: "s" },
      linux: { ctrlKey: true, key: "s" },
    },
    () => {
      if (!isStandAlone) openSharedModal("spotlight-search");
    }
  );

  useDragAndDrop({
    mimeTypes: ["text/plain"],
    onDrop: (data) => {
      const prefix = "authlib-injector:yggdrasil-server:";
      if (data.startsWith(prefix)) {
        const url = data.slice(prefix.length);
        const decodeUrl = decodeURIComponent(url);
        if (!isStandAlone && decodeUrl)
          openSharedModal("add-auth-server", { presetUrl: decodeUrl });
      }
    },
  });

  useDeepLink({
    trigger: /^add-auth-server\/?(?:\?.*)?$/,
    onCall: (path, _) => {
      const url = new URL(path).searchParams.get("url") || "";
      const decodeUrl = decodeURIComponent(url);
      if (!isStandAlone && decodeUrl) {
        openSharedModal("add-auth-server", { presetUrl: decodeUrl });
      }
    },
  });

  useDeepLink({
    trigger: /^launch\/?(?:\?.*)?$/,
    onCall: (path, _) => {
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
  });

  return <>{children}</>;
};

export default GlobalEventHandler;

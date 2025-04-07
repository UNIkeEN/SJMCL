import { useRouter } from "next/router";
import AddAuthServerModal from "@/components/modals/add-auth-server-modal";
import CopyOrMoveModal from "@/components/modals/copy-or-move-modal";
import DeleteGameInstanceDialog from "@/components/modals/delete-game-instance-alert-dialog";
import DownloadResourceModal from "@/components/modals/download-resource-modal";
import LaunchProcessModal from "@/components/modals/launch-process-modal";
import SpotlightSearchModal from "@/components/modals/spotlight-search-modal";
import { SharedModalContextProvider } from "@/contexts/shared-modal";
import { useSharedModals } from "@/contexts/shared-modal";
import useDragAndDrop from "@/hooks/drag-and-drop";
import useKeyboardShortcut from "@/hooks/keyboard-shortcut";

const SharedModalsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <SharedModalContextProvider>
      <SharedModals>{children}</SharedModals>
    </SharedModalContextProvider>
  );
};

const SharedModals: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const router = useRouter();
  const isStandAlone = router.pathname.startsWith("/standalone");
  const { modalStates, openSharedModal, closeSharedModal } = useSharedModals();

  const modals: Record<string, React.FC<any>> = {
    "add-auth-server": AddAuthServerModal,
    "copy-or-move": CopyOrMoveModal,
    "delete-game-instance-alert": DeleteGameInstanceDialog,
    "download-resource": DownloadResourceModal,
    launch: LaunchProcessModal,
    "spotlight-search": SpotlightSearchModal,
  };

  // global shared modals.
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
        try {
          const url = decodeURIComponent(data.slice(prefix.length));
          openSharedModal("add-auth-server", { presetUrl: url });
        } catch (e) {
          console.error("Dropped invalid URL:", e);
        }
      }
    },
  });

  return (
    <>
      {children}

      {Object.keys(modals).map((key) => {
        const modalParams = modalStates[key];
        if (!modalParams) return null;

        const SpecModal = modals[key];
        return (
          <SpecModal
            key={key}
            {...modalParams}
            onClose={() => closeSharedModal(key)}
          />
        );
      })}
    </>
  );
};

export default SharedModalsProvider;

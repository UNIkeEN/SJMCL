import AddAuthServerModal from "@/components/modals/add-auth-server-modal";
import CopyOrMoveModal from "@/components/modals/copy-or-move-modal";
import DeleteInstanceDialog from "@/components/modals/delete-instance-alert-dialog";
import DownloadResourceModal from "@/components/modals/download-resource-modal";
import GenericConfirmDialog from "@/components/modals/generic-confirm-dialog";
import LaunchProcessModal from "@/components/modals/launch-process-modal";
import ReLoginPlayerModal from "@/components/modals/relogin-player-modal";
import SpotlightSearchModal from "@/components/modals/spotlight-search-modal";
import { SharedModalContextProvider } from "@/contexts/shared-modal";
import { useSharedModals } from "@/contexts/shared-modal";

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
  const { modalStates, closeSharedModal } = useSharedModals();

  const modals: Record<string, React.FC<any>> = {
    "add-auth-server": AddAuthServerModal,
    "copy-or-move": CopyOrMoveModal,
    "delete-instance-alert": DeleteInstanceDialog,
    "download-resource": DownloadResourceModal,
    "generic-confirm": GenericConfirmDialog,
    launch: LaunchProcessModal,
    relogin: ReLoginPlayerModal,
    "spotlight-search": SpotlightSearchModal,
  };

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

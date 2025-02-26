import CopyOrMoveModal from "@/components/modals/copy-or-move-modal";
import DownloadResourceModal from "@/components/modals/download-resource-modal";
import SpotlightSearchModal from "@/components/modals/spotlight-search-modal";
import { SharedModalContextProvider } from "@/contexts/shared-modal";
import { useSharedModals } from "@/contexts/shared-modal";
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
  const { modalStates, openSharedModal, closeSharedModal } = useSharedModals();

  const modals: Record<string, React.FC<any>> = {
    "spotlight-search": SpotlightSearchModal,
    "copy-or-move": CopyOrMoveModal,
    "download-resource": DownloadResourceModal,
  };

  useKeyboardShortcut(
    {
      macos: { metaKey: true, key: "s" },
      windows: { ctrlKey: true, key: "s" },
      linux: { ctrlKey: true, key: "s" },
    },
    () => openSharedModal("spotlight-search")
  );

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

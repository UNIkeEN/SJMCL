import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { useLauncherConfig } from "@/contexts/config";

interface SharedModalContextType {
  openSharedModal: (
    key: string,
    params?: any,
    options?: { stack?: boolean }
  ) => void;
  closeSharedModal: (key: string, modalId?: number) => void;
  openGenericConfirmDialog: (params?: any) => void;
  modalStates: { key: string; modalId: number; params: any }[];
}

export const SharedModalContext = createContext<
  SharedModalContextType | undefined
>(undefined);

export const SharedModalContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [modalStates, setModalStates] = useState<
    SharedModalContextType["modalStates"]
  >([]);
  const nextModalId = useRef(0);
  const { config } = useLauncherConfig();

  const openSharedModal = useCallback(
    (key: string, params: any = {}, options?: { stack?: boolean }) => {
      const modalId = nextModalId.current++;
      setModalStates((prev) => {
        const index = prev.map((modal) => modal.key).lastIndexOf(key);
        // Append when stacking or no matching modal exists.
        // Otherwise, update only the topmost matching modal.
        return options?.stack || index === -1
          ? [...prev, { key, modalId, params }]
          : prev.map((modal, i) =>
              i === index ? { ...modal, params } : modal
            );
      });
      logger.info("Opened shared modal:", key, params);
    },
    []
  );

  const closeSharedModal = useCallback((key: string, modalId?: number) => {
    setModalStates((prev) =>
      prev.filter(
        (modal) =>
          modal.key !== key ||
          (modalId !== undefined && modal.modalId !== modalId)
      )
    );
  }, []);

  const openGenericConfirmDialog = useCallback(
    (params?: any) => {
      // If the user has previously selected "Don't show again", skip the dialog and call the OK callback directly
      if (
        params.suppressKey &&
        config.suppressedDialogs?.includes(params.suppressKey)
      ) {
        params?.onOKCallback?.();
        return;
      }
      openSharedModal("generic-confirm", {
        ...params,
      });
    },
    [config.suppressedDialogs, openSharedModal]
  );

  return (
    <SharedModalContext.Provider
      value={{
        openSharedModal,
        closeSharedModal,
        openGenericConfirmDialog,
        modalStates,
      }}
    >
      {children}
    </SharedModalContext.Provider>
  );
};

export const useSharedModals = (): SharedModalContextType => {
  const context = useContext(SharedModalContext);
  if (!context) {
    throw new Error(
      "useSharedModals must be used within a SharedModalContextProvider"
    );
  }
  return context;
};

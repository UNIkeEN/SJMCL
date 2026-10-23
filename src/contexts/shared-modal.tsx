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
  closeSharedModal: (key: string, instanceId?: number) => void;
  openGenericConfirmDialog: (params?: any) => void;
  modalStates: { key: string; instanceId: number; params: any }[];
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
  const nextInstanceId = useRef(0);
  const { config } = useLauncherConfig();

  const openSharedModal = useCallback(
    (key: string, params: any = {}, options?: { stack?: boolean }) => {
      const instanceId = nextInstanceId.current++;
      setModalStates((prev) => {
        // Nested resources need separate portals, focus locks and callbacks.
        if (!options?.stack && prev.some((modal) => modal.key === key)) {
          return prev.map((modal) =>
            modal.key === key ? { ...modal, params } : modal
          );
        }
        return [...prev, { key, instanceId, params }];
      });
      logger.info("Opened shared modal:", key, params);
    },
    []
  );

  const closeSharedModal = useCallback((key: string, instanceId?: number) => {
    setModalStates((prev) =>
      prev.filter(
        (modal) =>
          modal.key !== key ||
          (instanceId !== undefined && modal.instanceId !== instanceId)
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

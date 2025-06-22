import React, { createContext, useContext, useState } from "react";
import { useLauncherConfig } from "@/contexts/config";

interface SharedModalContextType {
  openSharedModal: (key: string, params?: any) => void;
  closeSharedModal: (key: string) => void;
  openGenericConfirmDialog: (
    suppressKey: string | undefined,
    params?: any
  ) => void;
  modalStates: Record<string, { isOpen: boolean; params: any }>;
}

export const SharedModalContext = createContext<
  SharedModalContextType | undefined
>(undefined);

export const SharedModalContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [modalStates, setModalStates] = useState<
    Record<string, { isOpen: boolean; params: any }>
  >({});
  const { config } = useLauncherConfig();

  const openSharedModal = (key: string, params: any = {}) => {
    setModalStates((prev) => ({
      ...prev,
      [key]: { isOpen: true, ...params },
    }));
  };

  const closeSharedModal = (key: string) => {
    setModalStates((prev) => {
      const { [key]: _, ...newStates } = prev;
      return newStates;
    });
  };
  const openGenericConfirmDialog = (suppressKey?: string, params?: any) => {
    if (suppressKey && config.confirmSuppress?.includes(suppressKey)) {
      params?.onOKCallback?.();
      return;
    }

    openSharedModal("generic-confirm", {
      ...params,
      showDontAskAgain: true,
    });
  };

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

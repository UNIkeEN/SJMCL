import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { useGetState } from "@/hooks/get-state";
import { ExtensionInfo } from "@/models/extension";
import { ExtensionService } from "@/services/extension";

interface ExtensionHostContextType {
  extensionList: ExtensionInfo[] | undefined;
  enabledExtensionList: ExtensionInfo[] | undefined;
  getExtensionList: (sync?: boolean) => ExtensionInfo[] | undefined;
}

const ExtensionHostContext = createContext<
  ExtensionHostContextType | undefined
>(undefined);

export const ExtensionHostContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { config } = useLauncherConfig();
  const toast = useToast();
  const [extensionList, setExtensionList] = useState<ExtensionInfo[]>();

  const handleRetrieveExtensionList = useCallback(() => {
    ExtensionService.retrieveExtensionList().then((response) => {
      if (response.status === "success") {
        setExtensionList(response.data);
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

  const enabledExtensionList = useMemo(() => {
    if (!extensionList) return undefined;
    const enabledSet = new Set(config.extension.enabled);
    return extensionList.filter((extension) =>
      enabledSet.has(extension.identifier)
    );
  }, [config.extension.enabled, extensionList]);

  const getExtensionList = useGetState(
    extensionList,
    handleRetrieveExtensionList
  );

  return (
    <ExtensionHostContext.Provider
      value={{ extensionList, enabledExtensionList, getExtensionList }}
    >
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

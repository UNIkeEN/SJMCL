import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { useRouter } from "next/router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useGlobalData, useGlobalDataDispatch } from "@/contexts/global-data";
import { useToast } from "@/contexts/toast";
import { InstanceSubdirType } from "@/enums/instance";
import { useGetState, usePromisedGetState } from "@/hooks/get-state";
import { GameConfig } from "@/models/config";
import {
  InstanceSummary,
  LocalModInfo,
  ResourcePackInfo,
  SchematicInfo,
  ScreenshotInfo,
  ShaderPackInfo,
} from "@/models/instance/misc";
import { WorldInfo } from "@/models/instance/world";
import { InstanceService } from "@/services/instance";
import { updateByKeyPath } from "@/utils/partial";

export interface InstanceContextType {
  summary: InstanceSummary | undefined;
  updateSummaryInContext: (path: string, value: any) => void;
  gameConfig: GameConfig | undefined;
  openInstanceSubdir: (dirType: InstanceSubdirType) => void;
  // retrieve instance resource data with frontend cache
  getWorldList: (sync?: boolean) => WorldInfo[] | undefined;
  getLocalModList: (sync?: boolean) => Promise<LocalModInfo[] | undefined>;
  isLocalModListLoading: boolean;
  getResourcePackList: (sync?: boolean) => ResourcePackInfo[] | undefined;
  getServerResourcePackList: (sync?: boolean) => ResourcePackInfo[] | undefined;
  getSchematicList: (sync?: boolean) => SchematicInfo[] | undefined;
  getShaderPackList: (sync?: boolean) => ShaderPackInfo[] | undefined;
  getScreenshotList: (sync?: boolean) => ScreenshotInfo[] | undefined;
  // getInstanceGameConfig: (sync?: boolean) => GameConfig | undefined;
  // shared service handler
  handleRetrieveInstanceSubdirPath: (
    dirType: InstanceSubdirType
  ) => Promise<string | null>;
  handleImportResource: (option: any) => void;
  handleUpdateInstanceConfig: (path: string, value: any) => void;
  handleResetInstanceGameConfig: () => void;
}

export const InstanceContext = createContext<InstanceContextType | undefined>(
  undefined
);

export const InstanceContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const router = useRouter();
  const toast = useToast();
  const { getInstanceList } = useGlobalData();
  const { setInstanceList } = useGlobalDataDispatch();

  const [instanceSummary, setInstanceSummary] = useState<
    InstanceSummary | undefined
  >(undefined);
  const [instanceGameConfig, setInstanceGameConfig] = useState<
    GameConfig | undefined
  >(undefined);

  const [worlds, setWorlds] = useState<WorldInfo[]>();
  const [localMods, setLocalMods] = useState<LocalModInfo[]>();
  const [resourcePacks, setResourcePacks] = useState<ResourcePackInfo[]>();
  const [serverResourcePacks, setServerResourcePacks] =
    useState<ResourcePackInfo[]>();
  const [schematics, setSchematics] = useState<SchematicInfo[]>();
  const [shaderPacks, setShaderPacks] = useState<ShaderPackInfo[]>();
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>();

  const updateSummaryInContext = useCallback(
    (path: string, value: any) => {
      // for frontend-only state update to sync with backend if needed.
      if (path === "id") return; // forbid update id here

      setInstanceSummary((prevSummary) => {
        if (!prevSummary) return prevSummary;

        const newSummary = { ...prevSummary };
        updateByKeyPath(newSummary, path, value);

        const instanceList = getInstanceList() || [];
        const updatedList = instanceList.map((instance) =>
          instance.id === newSummary.id ? newSummary : instance
        );
        setInstanceList(updatedList as InstanceSummary[]);

        return newSummary;
      });
    },
    [getInstanceList, setInstanceList]
  );

  const handleRetrieveInstanceGameConfig = useCallback(
    (id: string) => {
      if (id !== undefined && id) {
        InstanceService.retrieveInstanceGameConfig(id).then((response) => {
          if (response.status === "success") {
            setInstanceGameConfig(response.data);
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        });
      }
    },
    [setInstanceGameConfig, toast]
  );

  useEffect(() => {
    const instanceList = getInstanceList() || [];
    let id = router.query.id;
    const instanceId = Array.isArray(id) ? id[0] : id;
    // get summary
    if (instanceId !== undefined) {
      const summary = instanceList.find(
        (instance) => instance.id === instanceId
      );
      setInstanceSummary(summary);
      handleRetrieveInstanceGameConfig(instanceId);
    }
  }, [router.query.id, getInstanceList, handleRetrieveInstanceGameConfig]);

  const handleRetrieveInstanceSubdirPath = useCallback(
    (dirType: InstanceSubdirType): Promise<string | null> => {
      if (instanceSummary?.id !== undefined) {
        return InstanceService.retrieveInstanceSubdirPath(
          instanceSummary.id,
          dirType
        ).then((response) => {
          if (response.status === "success") {
            return response.data;
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
            return null;
          }
        });
      }
      return Promise.resolve(null);
    },
    [instanceSummary?.id, toast]
  );

  const openInstanceSubdir = useCallback(
    (dirType: InstanceSubdirType) => {
      handleRetrieveInstanceSubdirPath(dirType).then((path) => {
        if (path) openPath(path);
      });
    },
    [handleRetrieveInstanceSubdirPath]
  );

  type ImportResourceOptions = {
    filterName: string;
    filterExt: string[];
    tgtDirType: InstanceSubdirType;
    decompress?: boolean;
    onSuccessCallback: () => void;
  };

  const handleImportResource = useCallback(
    (options: ImportResourceOptions) => {
      const {
        filterName,
        filterExt,
        tgtDirType,
        decompress = false,
        onSuccessCallback,
      } = options;
      if (instanceSummary?.id !== undefined) {
        open({
          multiple: false,
          filters: [
            {
              name: filterName,
              extensions: filterExt,
            },
          ],
        }).then((selectedPath) => {
          if (!selectedPath) return;
          InstanceService.copyResourceToInstances(
            selectedPath,
            [instanceSummary.id],
            tgtDirType,
            decompress
          ).then((response) => {
            if (response.status === "success") {
              toast({
                title: response.message,
                status: "success",
              });
              onSuccessCallback();
              // KNOWN ISSUE: When the successfully copied file cannot be loaded as world/mod etc. But this handler will still toast success.
            } else
              toast({
                title: response.message,
                description: response.details,
                status: "error",
              });
          });
        });
      }
    },
    [instanceSummary?.id, toast]
  );

  const handleRetrieveWorldList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retrieveWorldList(instanceSummary.id).then((response) => {
        if (response.status === "success") {
          setWorlds(
            [...response.data].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
          );
        } else
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
      });
    }
  }, [instanceSummary?.id, setWorlds, toast]);

  const handleRetrieveLocalModList = useCallback(async () => {
    if (instanceSummary?.id !== undefined) {
      const response = await InstanceService.retrieveLocalModList(
        instanceSummary.id
      );
      if (response.status === "success") {
        setLocalMods(response.data);
        return response.data;
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
        setLocalMods([]);
        return [];
      }
    }
  }, [instanceSummary?.id, setLocalMods, toast]);

  const handleRetrieveResourcePackList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retrieveResourcePackList(instanceSummary.id).then(
        (response) => {
          if (response.status === "success") setResourcePacks(response.data);
          else
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
        }
      );
    }
  }, [instanceSummary?.id, setResourcePacks, toast]);

  const handleServerRetrieveResourcePackList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retrieveServerResourcePackList(instanceSummary.id).then(
        (response) => {
          if (response.status === "success")
            setServerResourcePacks(response.data);
          else
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
        }
      );
    }
  }, [instanceSummary?.id, setServerResourcePacks, toast]);

  const handleRetrieveSchematicList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retrieveSchematicList(instanceSummary.id).then(
        (response) => {
          if (response.status === "success") setSchematics(response.data);
          else
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
        }
      );
    }
  }, [instanceSummary?.id, setSchematics, toast]);

  const handleRetrieveShaderPackList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retrieveShaderPackList(instanceSummary.id).then(
        (response) => {
          if (response.status === "success") setShaderPacks(response.data);
          else
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
        }
      );
    }
  }, [instanceSummary?.id, setShaderPacks, toast]);

  const handleRetrieveScreenshotList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retrieveScreenshotList(instanceSummary.id).then(
        (response) => {
          if (response.status === "success")
            setScreenshots([...response.data].sort((a, b) => b.time - a.time));
          else
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
        }
      );
    }
  }, [instanceSummary?.id, setScreenshots, toast]);

  const handleUpdateInstanceConfig = useCallback(
    (path: string, value: any) => {
      if (instanceSummary?.id !== undefined) {
        InstanceService.updateInstanceConfig(
          instanceSummary.id,
          path,
          value
        ).then((response) => {
          if (response.status !== "success") {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          } else {
            if (path.startsWith("specGameConfig")) {
              const newConfig = { ...instanceGameConfig };
              updateByKeyPath(
                newConfig,
                path.replace("specGameConfig.", ""),
                value
              );
              setInstanceGameConfig(newConfig as GameConfig);
              // version isolation is shared by summary and game config struct.
              if (path === "specGameConfig.versionIsolation")
                updateSummaryInContext("isVersionIsolated", value);
            } else if (path === "useSpecGameConfig") {
              updateSummaryInContext(path, value);
              if (value) handleRetrieveInstanceGameConfig(instanceSummary.id);
            } else {
              updateSummaryInContext(path, value);
            }
          }
        });
      }
    },
    [
      instanceSummary?.id,
      instanceGameConfig,
      handleRetrieveInstanceGameConfig,
      setInstanceGameConfig,
      toast,
      updateSummaryInContext,
    ]
  );

  const handleResetInstanceGameConfig = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.resetInstanceGameConfig(instanceSummary.id).then(
        (response) => {
          if (response.status === "success") {
            toast({
              title: response.message,
              status: "success",
            });
            handleRetrieveInstanceGameConfig(instanceSummary.id);
          } else
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
        }
      );
    }
  }, [instanceSummary?.id, handleRetrieveInstanceGameConfig, toast]);

  const getWorldList = useGetState(worlds, handleRetrieveWorldList);

  const [getLocalModList, isLocalModListLoading] = usePromisedGetState(
    localMods,
    handleRetrieveLocalModList
  );

  useEffect(() => {
    if (instanceSummary?.id) {
      getLocalModList(true).then((mods) => {
        setLocalMods(mods);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceSummary?.id]);

  const getResourcePackList = useGetState(
    resourcePacks,
    handleRetrieveResourcePackList
  );

  const getServerResourcePackList = useGetState(
    serverResourcePacks,
    handleServerRetrieveResourcePackList
  );

  const getSchematicList = useGetState(schematics, handleRetrieveSchematicList);

  const getShaderPackList = useGetState(
    shaderPacks,
    handleRetrieveShaderPackList
  );

  const getScreenshotList = useGetState(
    screenshots,
    handleRetrieveScreenshotList
  );

  // const getInstanceGameConfig = useGetState(
  //   instanceGameConfig,
  //   handleRetrieveInstanceGameConfig
  // );

  return (
    <InstanceContext.Provider
      value={{
        summary: instanceSummary,
        updateSummaryInContext,
        gameConfig: instanceGameConfig,
        openInstanceSubdir,
        getWorldList,
        getLocalModList,
        isLocalModListLoading,
        getResourcePackList,
        getServerResourcePackList,
        getSchematicList,
        getShaderPackList,
        getScreenshotList,
        // getInstanceGameConfig,
        handleRetrieveInstanceSubdirPath,
        handleImportResource,
        handleUpdateInstanceConfig,
        handleResetInstanceGameConfig,
      }}
    >
      {children}
    </InstanceContext.Provider>
  );
};

export const useInstanceSharedData = (): InstanceContextType => {
  const context = useContext(InstanceContext);
  if (!context) {
    throw new Error(
      "useInstanceSharedData must be used within a InstanceContextProvider"
    );
  }
  return context;
};

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
import { GetStateFlag, usePromisedGetState } from "@/hooks/get-state";
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
  getWorldList: (
    sync?: boolean
  ) => Promise<WorldInfo[] | GetStateFlag | undefined>;
  isWorldListLoading: boolean;
  getLocalModList: (
    sync?: boolean
  ) => Promise<LocalModInfo[] | GetStateFlag | undefined>;
  isLocalModListLoading: boolean;
  getResourcePackList: (
    sync?: boolean
  ) => Promise<ResourcePackInfo[] | GetStateFlag | undefined>;
  isResourcePackListLoading: boolean;
  getServerResourcePackList: (
    sync?: boolean
  ) => Promise<ResourcePackInfo[] | GetStateFlag | undefined>;
  isServerResourcePackListLoading: boolean;
  getSchematicList: (
    sync?: boolean
  ) => Promise<SchematicInfo[] | GetStateFlag | undefined>;
  isSchematicListLoading: boolean;
  getShaderPackList: (
    sync?: boolean
  ) => Promise<ShaderPackInfo[] | GetStateFlag | undefined>;
  isShaderPackListLoading: boolean;
  getScreenshotList: (
    sync?: boolean
  ) => Promise<ScreenshotInfo[] | GetStateFlag | undefined>;
  isScreenshotListLoading: boolean;
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

  const summaryIdRef = React.useRef<string | undefined>(undefined);
  useEffect(() => {
    if (instanceSummary?.id) {
      summaryIdRef.current = instanceSummary.id;
    } else {
      summaryIdRef.current = undefined;
    }
  }, [instanceSummary?.id]);

  const clearAllResState = useCallback(() => {
    setWorlds(undefined);
    setLocalMods(undefined);
    setResourcePacks(undefined);
    setServerResourcePacks(undefined);
    setSchematics(undefined);
    setShaderPacks(undefined);
    setScreenshots(undefined);
  }, []);

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

  const handleRetrieveWorldList = useCallback(async () => {
    if (summaryIdRef.current === undefined) {
      return;
    }
    let lastSummaryIdRef = summaryIdRef.current;
    const response = await InstanceService.retrieveWorldList(
      summaryIdRef.current
    );
    if (lastSummaryIdRef !== summaryIdRef.current) {
      return "%CANCELLED%"; // to avoid state update after unmount
    }
    if (response.status === "success") {
      setWorlds(
        [...response.data].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
      );
      return response.data;
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
      setResourcePacks([]);
      return [];
    }
  }, [setWorlds, toast]);

  const handleRetrieveLocalModList = useCallback(async () => {
    if (summaryIdRef.current === undefined) {
      return;
    }
    let lastSummaryIdRef = summaryIdRef.current;
    const response = await InstanceService.retrieveLocalModList(
      summaryIdRef.current
    );
    if (lastSummaryIdRef !== summaryIdRef.current) {
      return "%CANCELLED%"; // to avoid state update after unmount
    }
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
  }, [setLocalMods, toast]);

  const handleRetrieveResourcePackList = useCallback(async () => {
    if (summaryIdRef.current === undefined) {
      return;
    }
    let lastSummaryIdRef = summaryIdRef.current;
    const response = await InstanceService.retrieveResourcePackList(
      summaryIdRef.current
    );
    if (lastSummaryIdRef !== summaryIdRef.current) {
      return "%CANCELLED%"; // to avoid state update after unmount
    }
    if (response.status === "success") {
      setResourcePacks(response.data);
      return response.data;
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
      setResourcePacks([]);
      return [];
    }
  }, [setResourcePacks, toast]);

  const handleServerRetrieveResourcePackList = useCallback(async () => {
    if (summaryIdRef.current === undefined) {
      return;
    }
    let lastSummaryIdRef = summaryIdRef.current;
    const response = await InstanceService.retrieveServerResourcePackList(
      summaryIdRef.current
    );
    if (lastSummaryIdRef !== summaryIdRef.current) {
      return "%CANCELLED%"; // to avoid state update after unmount
    }
    if (response.status === "success") {
      setServerResourcePacks(response.data);
      return response.data;
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
      setServerResourcePacks([]);
      return [];
    }
  }, [setServerResourcePacks, toast]);

  const handleRetrieveSchematicList = useCallback(async () => {
    if (summaryIdRef.current === undefined) {
      return;
    }
    let lastSummaryIdRef = summaryIdRef.current;
    const response = await InstanceService.retrieveSchematicList(
      summaryIdRef.current
    );
    if (lastSummaryIdRef !== summaryIdRef.current) {
      return "%CANCELLED%"; // to avoid state update after unmount
    }
    if (response.status === "success") {
      setSchematics(response.data);
      return response.data;
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
      setSchematics([]);
      return [];
    }
  }, [setSchematics, toast]);

  const handleRetrieveShaderPackList = useCallback(async () => {
    if (summaryIdRef.current === undefined) {
      return;
    }
    let lastSummaryIdRef = summaryIdRef.current;
    const response = await InstanceService.retrieveShaderPackList(
      summaryIdRef.current
    );
    if (lastSummaryIdRef !== summaryIdRef.current) {
      return "%CANCELLED%"; // to avoid state update after unmount
    }
    if (response.status === "success") {
      setShaderPacks(response.data);
      return response.data;
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
      setShaderPacks([]);
      return [];
    }
  }, [setShaderPacks, toast]);

  const handleRetrieveScreenshotList = useCallback(async () => {
    if (summaryIdRef.current === undefined) {
      return;
    }
    let lastSummaryIdRef = summaryIdRef.current;
    const response = await InstanceService.retrieveScreenshotList(
      summaryIdRef.current
    );
    if (lastSummaryIdRef !== summaryIdRef.current) {
      return "%CANCELLED%"; // to avoid state update after unmount
    }
    if (response.status === "success") {
      setScreenshots([...response.data].sort((a, b) => b.time - a.time));
      return response.data;
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
      setScreenshots([]);
      return [];
    }
  }, [setScreenshots, toast]);

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
              clearAllResState();
            } else if (path === "useSpecGameConfig") {
              updateSummaryInContext(path, value);
              if (value) handleRetrieveInstanceGameConfig(instanceSummary.id);
              // clear all cached resource state due to version isolation may change.
              clearAllResState();
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
      clearAllResState,
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

  const [getWorldList, isWorldListLoading] = usePromisedGetState(
    worlds,
    handleRetrieveWorldList
  );

  const [getLocalModList, isLocalModListLoading] = usePromisedGetState(
    localMods,
    handleRetrieveLocalModList
  );

  const [getResourcePackList, isResourcePackListLoading] = usePromisedGetState(
    resourcePacks,
    handleRetrieveResourcePackList
  );

  const [getServerResourcePackList, isServerResourcePackListLoading] =
    usePromisedGetState(
      serverResourcePacks,
      handleServerRetrieveResourcePackList
    );

  const [getSchematicList, isSchematicListLoading] = usePromisedGetState(
    schematics,
    handleRetrieveSchematicList
  );

  const [getShaderPackList, isShaderPackListLoading] = usePromisedGetState(
    shaderPacks,
    handleRetrieveShaderPackList
  );

  const [getScreenshotList, isScreenshotListLoading] = usePromisedGetState(
    screenshots,
    handleRetrieveScreenshotList
  );

  useEffect(() => {
    if (instanceSummary?.id) {
      getLocalModList(true).then((mods) => {
        if (mods === GetStateFlag.Cancelled) return;
        setLocalMods(mods);
      });
      getWorldList(true).then((worlds) => {
        if (worlds === GetStateFlag.Cancelled) return;
        setWorlds(worlds);
      });
      getResourcePackList(true).then((packs) => {
        if (packs === GetStateFlag.Cancelled) return;
        setResourcePacks(packs);
      });
      getServerResourcePackList(true).then((packs) => {
        if (packs === GetStateFlag.Cancelled) return;
        setServerResourcePacks(packs);
      });
      getSchematicList(true).then((schematics) => {
        if (schematics === GetStateFlag.Cancelled) return;
        setSchematics(schematics);
      });
      getShaderPackList(true).then((packs) => {
        if (packs === GetStateFlag.Cancelled) return;
        setShaderPacks(packs);
      });
      getScreenshotList(true).then((screenshots) => {
        if (screenshots === GetStateFlag.Cancelled) return;
        setScreenshots(screenshots);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceSummary?.id]);

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
        isWorldListLoading,
        getLocalModList,
        isLocalModListLoading,
        getResourcePackList,
        isResourcePackListLoading,
        getServerResourcePackList,
        isServerResourcePackListLoading,
        getSchematicList,
        isSchematicListLoading,
        getShaderPackList,
        isShaderPackListLoading,
        getScreenshotList,
        isScreenshotListLoading,
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

import { open } from "@tauri-apps/plugin-dialog";
import { useRouter } from "next/router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useData, useDataDispatch } from "@/contexts/data";
import { useToast } from "@/contexts/toast";
import { InstanceSubdirEnums } from "@/enums/instance";
import { useGetState } from "@/hooks/get-state";
import {
  GameInstanceSummary,
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
  summary: GameInstanceSummary | undefined;
  updateSummary: (path: string, value: any) => void;
  getWorldList: (sync?: boolean) => WorldInfo[] | undefined;
  getLocalModList: (sync?: boolean) => LocalModInfo[] | undefined;
  getResourcePackList: (sync?: boolean) => ResourcePackInfo[] | undefined;
  getServerResourcePackList: (sync?: boolean) => ResourcePackInfo[] | undefined;
  getSchematicList: (sync?: boolean) => SchematicInfo[] | undefined;
  getShaderPackList: (sync?: boolean) => ShaderPackInfo[] | undefined;
  getScreenshotList: (sync?: boolean) => ScreenshotInfo[] | undefined;
  // shared service handler
  handleOpenInstanceSubdir: (dirType: InstanceSubdirEnums) => void;
  handleImportResource: (option: any) => void;
}

export const InstanceContext = createContext<InstanceContextType | undefined>(
  undefined
);

export const InstanceContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const router = useRouter();
  const toast = useToast();
  const { getGameInstanceList } = useData();
  const { setGameInstanceList } = useDataDispatch();

  const [instanceSummary, setInstanceSummary] = useState<
    GameInstanceSummary | undefined
  >(undefined);
  const [worlds, setWorlds] = useState<WorldInfo[]>();
  const [localMods, setLocalMods] = useState<LocalModInfo[]>();
  const [resourcePacks, setResourcePacks] = useState<ResourcePackInfo[]>();
  const [serverResourcePacks, setServerResourcePacks] =
    useState<ResourcePackInfo[]>();
  const [schematics, setSchematics] = useState<SchematicInfo[]>();
  const [shaderPacks, setShaderPacks] = useState<ShaderPackInfo[]>();
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>();

  useEffect(() => {
    const gameInstanceList = getGameInstanceList() || [];
    const { id } = router.query;
    const instanceId = Array.isArray(id) ? id[0] : id;
    if (instanceId !== undefined) {
      setInstanceSummary(
        gameInstanceList.find((instance) => instance.id === Number(instanceId))
      );
    }
  }, [router.query, getGameInstanceList]);

  const updateSummary = (path: string, value: any) => {
    // for frontend-only state update to sync with backend if needed.
    if (path === "id") return; // forbid update id here

    const newSummary = { ...instanceSummary };
    updateByKeyPath(newSummary, path, value);
    setInstanceSummary(newSummary as GameInstanceSummary);

    const gameInstanceList = getGameInstanceList() || [];
    const updatedList = gameInstanceList.map((instance) =>
      instance.id === newSummary.id
        ? (newSummary as GameInstanceSummary)
        : instance
    );
    setGameInstanceList(updatedList);
  };

  const handleOpenInstanceSubdir = useCallback(
    (dirType: InstanceSubdirEnums) => {
      if (instanceSummary?.id !== undefined) {
        InstanceService.openInstanceSubdir(instanceSummary.id, dirType).then(
          (response) => {
            if (response.status !== "success")
              toast({
                title: response.message,
                description: response.details,
                status: "error",
              });
          }
        );
      }
    },
    [instanceSummary?.id, toast]
  );

  type ImportResourceOptions = {
    filterName: string;
    filterExt: string[];
    tgtDirType: InstanceSubdirEnums;
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

  const handleRetrieveLocalModList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retrieveLocalModList(instanceSummary.id).then(
        (response) => {
          if (response.status === "success") setLocalMods(response.data);
          else
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
        }
      );
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
          if (response.status === "success") setScreenshots(response.data);
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

  const getWorldList = useGetState(worlds, handleRetrieveWorldList);

  const getLocalModList = useGetState(localMods, handleRetrieveLocalModList);

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

  return (
    <InstanceContext.Provider
      value={{
        summary: instanceSummary,
        updateSummary,
        getWorldList,
        getLocalModList,
        getResourcePackList,
        getServerResourcePackList,
        getSchematicList,
        getShaderPackList,
        getScreenshotList,
        handleOpenInstanceSubdir,
        handleImportResource,
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

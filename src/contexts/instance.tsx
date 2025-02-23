import { useRouter } from "next/router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useData } from "@/contexts/data";
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
  WorldInfo,
} from "@/models/instance";
import { InstanceService } from "@/services/instance";

export interface InstanceContextType {
  summary: GameInstanceSummary | undefined;
  openSubdir: (dirType: InstanceSubdirEnums) => void;
  getWorldList: (sync?: boolean) => WorldInfo[] | undefined;
  getLocalModList: (sync?: boolean) => LocalModInfo[] | undefined;
  getResourcePackList: (sync?: boolean) => ResourcePackInfo[] | undefined;
  getServerResourcePackList: (sync?: boolean) => ResourcePackInfo[] | undefined;
  getSchematicList: (sync?: boolean) => SchematicInfo[] | undefined;
  getShaderPackList: (sync?: boolean) => ShaderPackInfo[] | undefined;
  getScreenshotList: (sync?: boolean) => ScreenshotInfo[] | undefined;
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
    const instanceId = router.query.id;
    if (instanceId !== undefined) {
      setInstanceSummary(
        gameInstanceList.find((instance) => instance.id === Number(instanceId))
      );
    }
  }, [router.query.id, getGameInstanceList]);

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
            console.log(response);
          }
        );
      }
    },
    [instanceSummary?.id, toast]
  );

  const handleRetriveWorldList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retriveWorldList(instanceSummary.id).then((response) => {
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

  const handleRetriveLocalModList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retriveLocalModList(instanceSummary.id).then(
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

  const handleRetriveResourcePackList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retriveResourcePackList(instanceSummary.id).then(
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

  const handleServerRetriveResourcePackList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retriveServerResourcePackList(instanceSummary.id).then(
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

  const handleRetriveSchematicList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retriveSchematicList(instanceSummary.id).then(
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

  const handleRetriveShaderPackList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retriveShaderPackList(instanceSummary.id).then(
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

  const handleRetriveScreenshotList = useCallback(() => {
    if (instanceSummary?.id !== undefined) {
      InstanceService.retriveScreenshotList(instanceSummary.id).then(
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

  const getWorldList = useGetState(worlds, handleRetriveWorldList);

  const getLocalModList = useGetState(localMods, handleRetriveLocalModList);

  const getResourcePackList = useGetState(
    resourcePacks,
    handleRetriveResourcePackList
  );

  const getServerResourcePackList = useGetState(
    serverResourcePacks,
    handleServerRetriveResourcePackList
  );

  const getSchematicList = useGetState(schematics, handleRetriveSchematicList);

  const getShaderPackList = useGetState(
    shaderPacks,
    handleRetriveShaderPackList
  );

  const getScreenshotList = useGetState(
    screenshots,
    handleRetriveScreenshotList
  );

  return (
    <InstanceContext.Provider
      value={{
        summary: instanceSummary,
        openSubdir: handleOpenInstanceSubdir,
        getWorldList,
        getLocalModList,
        getResourcePackList,
        getServerResourcePackList,
        getSchematicList,
        getShaderPackList,
        getScreenshotList,
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

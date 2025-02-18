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
import { InstanceSubdirType } from "@/enums/instance";
import { useGetState } from "@/hooks/get-state";
import {
  GameInstanceSummary,
  ResourcePackInfo,
  SchematicInfo,
  ScreenshotInfo,
  ShaderPackInfo,
} from "@/models/game-instance";
import { InstanceService } from "@/services/instance";

export interface InstanceContextType {
  summary: GameInstanceSummary | undefined;
  openSubdir: (dirType: InstanceSubdirType) => void;
  getResourcePackList: (sync?: boolean) => ResourcePackInfo[] | undefined;
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
  const [resourcePacks, setResourcePacks] = useState<ResourcePackInfo[]>();
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
    (dirType: InstanceSubdirType) => {
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

  const getResourcePackList = useGetState(
    resourcePacks,
    handleRetriveResourcePackList
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
        getResourcePackList,
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

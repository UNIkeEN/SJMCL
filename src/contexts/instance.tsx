import { Box, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/router";
import React, { useContext, useEffect } from "react";
import { createContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuHouse } from "react-icons/lu";
import NavMenu from "@/components/common/nav-menu";
import { useData } from "@/contexts/data";
import {
  GameInstanceSummary,
  mockGameInstanceSummaryList,
} from "@/models/game-instance";

export interface InstanceContextType {
  currentInstance: GameInstanceSummary | undefined;
  setCurrentInstance: (instance: GameInstanceSummary | undefined) => void;
  initializeInstance: (id: number) => void;
  clearInstance: () => void;
}

export const InstanceContext = createContext<InstanceContextType>({
  currentInstance: undefined,
  setCurrentInstance: () => {},
  initializeInstance: () => {},
  clearInstance: () => {},
});

export const InstanceContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [currentInstance, setCurrentInstance] = useState<
    GameInstanceSummary | undefined
  >(undefined);
  const router = useRouter();

  const initializeInstance = (id: number) => {
    const instance = mockGameInstanceSummaryList.find((item) => item.id === id);
    if (instance) {
      setCurrentInstance(instance);
    } else {
      setCurrentInstance(undefined);
    }
  };

  const clearInstance = () => {
    setCurrentInstance(undefined);
  };

  useEffect(() => {
    const instanceId = Number(router.query.id);
    if (instanceId) {
      initializeInstance(instanceId);
    }
  }, [router.query.id]);

  return (
    <InstanceContext.Provider
      value={{
        currentInstance,
        setCurrentInstance,
        initializeInstance,
        clearInstance,
      }}
    >
      {children}
    </InstanceContext.Provider>
  );
};

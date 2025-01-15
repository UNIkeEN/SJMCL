import { useRouter } from "next/router";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useData } from "@/contexts/data";
import { GameInstanceSummary } from "@/models/game-instance";

export interface InstanceContextType {
  summary: GameInstanceSummary | undefined;
}

export const InstanceContext = createContext<InstanceContextType>({
  summary: undefined,
});

export const InstanceContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const router = useRouter();
  const [instanceSummary, setInstanceSummary] = useState<
    GameInstanceSummary | undefined
  >(undefined);
  const { gameInstanceSummaryList } = useData();

  useEffect(() => {
    const instanceId = Number(router.query.id);
    if (instanceId) {
      setInstanceSummary(
        gameInstanceSummaryList.find((instance) => instance.id === instanceId)
      );
    }
  }, [router.query.id, gameInstanceSummaryList]);

  return (
    <InstanceContext.Provider value={{ summary: instanceSummary }}>
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

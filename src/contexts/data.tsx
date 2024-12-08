import React, { createContext, useContext, useEffect, useState } from "react";
import {
  AuthServer,
  Role,
  mockAuthServerList,
  mockRoleList,
} from "@/models/account";
import {
  GameInstanceSummary,
  mockGameInstanceSummaryList,
} from "@/models/game-instance";

interface DataContextType {
  roleList: Role[];
  selectedRole: Role | undefined;
  gameInstanceSummaryList: GameInstanceSummary[];
  selectedGameInstance: GameInstanceSummary | undefined;
  authServerList: AuthServer[];
}

interface DataDispatchContextType {
  setRoleList: React.Dispatch<Role[]>;
  setSelectedRole: React.Dispatch<Role | undefined>;
  setGameInstanceSummaryList: React.Dispatch<GameInstanceSummary[]>;
  setSelectedGameInstance: React.Dispatch<GameInstanceSummary | undefined>;
  setAuthServerList: React.Dispatch<AuthServer[]>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const DataDispatchContext = createContext<DataDispatchContextType | undefined>(
  undefined
);

export const DataContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [roleList, setRoleList] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role>();
  const [gameInstanceSummaryList, setGameInstanceSummaryList] = useState<
    GameInstanceSummary[]
  >([]);
  const [selectedGameInstance, setSelectedGameInstance] =
    useState<GameInstanceSummary>();
  const [authServerList, setAuthServerList] = useState<AuthServer[]>([]);

  useEffect(() => {
    setRoleList(mockRoleList);
    setSelectedRole(mockRoleList[0]);
    setGameInstanceSummaryList(mockGameInstanceSummaryList);
    setSelectedGameInstance(mockGameInstanceSummaryList[0]);
    setAuthServerList(mockAuthServerList);
  }, []);

  return (
    <DataContext.Provider
      value={{
        roleList,
        selectedRole,
        gameInstanceSummaryList,
        selectedGameInstance,
        authServerList,
      }}
    >
      <DataDispatchContext.Provider
        value={{
          setRoleList,
          setSelectedRole,
          setGameInstanceSummaryList,
          setSelectedGameInstance,
          setAuthServerList,
        }}
      >
        {children}
      </DataDispatchContext.Provider>
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataContextProvider");
  }
  return context;
};

export const useDataDispatch = (): DataDispatchContextType => {
  const context = useContext(DataDispatchContext);
  if (!context) {
    throw new Error(
      "useDataDispatch must be used within a DataContextProvider"
    );
  }
  return context;
};

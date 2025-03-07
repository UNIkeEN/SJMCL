import React, { createContext, useCallback, useContext, useState } from "react";
import { useToast } from "@/contexts/toast";
import { useGetState } from "@/hooks/get-state";
import { AuthServer, Player } from "@/models/account";
import { GameInstanceSummary } from "@/models/instance/misc";
import { AccountService } from "@/services/account";
import { InstanceService } from "@/services/instance";

interface DataContextType {
  getPlayerList: (sync?: boolean) => Player[] | undefined;
  getSelectedPlayer: (sync?: boolean) => Player | undefined;
  getGameInstanceList: (sync?: boolean) => GameInstanceSummary[] | undefined;
  getSelectedGameInstance: (sync?: boolean) => GameInstanceSummary | undefined;
  getAuthServerList: (sync?: boolean) => AuthServer[] | undefined;
}

interface DataDispatchContextType {
  setPlayerList: React.Dispatch<Player[]>;
  setSelectedPlayer: React.Dispatch<Player | undefined>;
  setGameInstanceList: React.Dispatch<GameInstanceSummary[]>;
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
  const toast = useToast();

  const [playerList, setPlayerList] = useState<Player[]>();
  const [selectedPlayer, setSelectedPlayer] = useState<Player>();
  const [gameInstanceList, setGameInstanceList] =
    useState<GameInstanceSummary[]>();
  const [selectedGameInstance, setSelectedGameInstance] =
    useState<GameInstanceSummary>();
  const [authServerList, setAuthServerList] = useState<AuthServer[]>();

  const handleRetrievePlayerList = useCallback(() => {
    AccountService.retrievePlayerList().then((response) => {
      if (response.status === "success") {
        setPlayerList(response.data);
        if (response.data.length > 0) {
          setSelectedPlayer(response.data[0]);
        }
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  }, [toast]);

  const handleRetrieveSelectedPlayer = useCallback(() => {
    AccountService.retrieveSelectedPlayer().then((response) => {
      if (response.status === "success") setSelectedPlayer(response.data);
      else setSelectedPlayer(undefined);
    });
  }, [setSelectedPlayer]);

  const handleRetrieveAuthServerList = useCallback(() => {
    AccountService.retrieveAuthServerList().then((response) => {
      if (response.status === "success") setAuthServerList(response.data);
      else
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
    });
  }, [setAuthServerList, toast]);

  const handleRetrieveInstanceList = useCallback(() => {
    InstanceService.retrieveInstanceList().then((response) => {
      if (response.status === "success") setGameInstanceList(response.data);
      else
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
    });
  }, [setGameInstanceList, toast]);

  const getPlayerList = useGetState(playerList, handleRetrievePlayerList);

  const getSelectedPlayer = useGetState(
    selectedPlayer,
    handleRetrieveSelectedPlayer
  );

  const getGameInstanceList = useGetState(
    gameInstanceList,
    handleRetrieveInstanceList
  );

  const getSelectedGameInstance = useGetState(selectedGameInstance, () =>
    setSelectedGameInstance(undefined)
  );

  const getAuthServerList = useGetState(
    authServerList,
    handleRetrieveAuthServerList
  );

  return (
    <DataContext.Provider
      value={{
        getPlayerList,
        getSelectedPlayer,
        getGameInstanceList,
        getSelectedGameInstance,
        getAuthServerList,
      }}
    >
      <DataDispatchContext.Provider
        value={{
          setPlayerList,
          setSelectedPlayer,
          setGameInstanceList,
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

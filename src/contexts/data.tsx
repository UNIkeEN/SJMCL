import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthServer, Player } from "@/models/account";
import { GameInstanceSummary } from "@/models/game-instance";
import { mockAuthServerList, mockPlayerList } from "@/models/mock/account";
import { mockGameInstanceSummaryList } from "@/models/mock/game-instance";

interface DataContextType {
  playerList: Player[];
  selectedPlayer: Player | undefined;
  gameInstanceSummaryList: GameInstanceSummary[];
  selectedGameInstance: GameInstanceSummary | undefined;
  authServerList: AuthServer[];
}

interface DataDispatchContextType {
  setPlayerList: React.Dispatch<Player[]>;
  setSelectedPlayer: React.Dispatch<Player | undefined>;
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
  const [playerList, setPlayerList] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player>();
  const [gameInstanceSummaryList, setGameInstanceSummaryList] = useState<
    GameInstanceSummary[]
  >([]);
  const [selectedGameInstance, setSelectedGameInstance] =
    useState<GameInstanceSummary>();
  const [authServerList, setAuthServerList] = useState<AuthServer[]>([]);

  useEffect(() => {
    setPlayerList(mockPlayerList);
    setSelectedPlayer(mockPlayerList[0]);
    setGameInstanceSummaryList(mockGameInstanceSummaryList);
    setSelectedGameInstance(mockGameInstanceSummaryList[0]);
    setAuthServerList(mockAuthServerList);
  }, []);

  return (
    <DataContext.Provider
      value={{
        playerList: playerList,
        selectedPlayer: selectedPlayer,
        gameInstanceSummaryList,
        selectedGameInstance,
        authServerList,
      }}
    >
      <DataDispatchContext.Provider
        value={{
          setPlayerList: setPlayerList,
          setSelectedPlayer: setSelectedPlayer,
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

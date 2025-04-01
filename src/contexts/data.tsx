import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useToast } from "@/contexts/toast";
import { useGetState } from "@/hooks/get-state";
import { AuthServer, Player } from "@/models/account";
import { GameInstanceSummary } from "@/models/instance/misc";
import { AccountService } from "@/services/account";
import { InstanceService } from "@/services/instance";
import { useLauncherConfig } from "./config";

interface DataContextType {
  selectedPlayer: Player | undefined;
  selectedGameInstance: GameInstanceSummary | undefined;
  getPlayerList: (sync?: boolean) => Player[] | undefined;
  getGameInstanceList: (sync?: boolean) => GameInstanceSummary[] | undefined;
  getAuthServerList: (sync?: boolean) => AuthServer[] | undefined;
}

// for frontend-only state update
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
  const { config } = useLauncherConfig();
  const toast = useToast();

  const [playerList, setPlayerList] = useState<Player[]>();
  const [selectedPlayer, setSelectedPlayer] = useState<Player>();
  const [gameInstanceList, setGameInstanceList] =
    useState<GameInstanceSummary[]>();
  const [selectedGameInstance, setSelectedGameInstance] =
    useState<GameInstanceSummary>();
  const [authServerList, setAuthServerList] = useState<AuthServer[]>();

  useEffect(() => {
    const selectedPlayerId = config.states.shared.selectedPlayerId;
    setSelectedPlayer(
      playerList?.find((player) => player.id === selectedPlayerId)
    );
  }, [playerList, config.states.shared.selectedPlayerId]);

  useEffect(() => {
    const selectedInstanceId = config.states.shared.selectedInstanceId;
    setSelectedGameInstance(
      gameInstanceList?.find(
        (instance) => instance.id === Number(selectedInstanceId)
      )
    );
  }, [gameInstanceList, config.states.shared.selectedInstanceId]);

  const handleRetrievePlayerList = useCallback(() => {
    AccountService.retrievePlayerList().then((response) => {
      if (response.status === "success") {
        setPlayerList(response.data);
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  }, [toast]);

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

  const getGameInstanceList = useGetState(
    // put starred instances at the top
    gameInstanceList
      ? [...gameInstanceList].sort(
          (a, b) => Number(b.starred) - Number(a.starred)
        )
      : undefined,
    handleRetrieveInstanceList
  );

  const getAuthServerList = useGetState(
    authServerList,
    handleRetrieveAuthServerList
  );

  return (
    <DataContext.Provider
      value={{
        selectedPlayer,
        selectedGameInstance,
        getPlayerList,
        getGameInstanceList,
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

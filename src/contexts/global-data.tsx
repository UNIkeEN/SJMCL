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
import { InstanceSummary } from "@/models/instance/misc";
import { AccountService } from "@/services/account";
import { InstanceService } from "@/services/instance";
import { useLauncherConfig } from "./config";

interface GlobalDataContextType {
  selectedPlayer: Player | undefined;
  selectedInstance: InstanceSummary | undefined;
  getPlayerList: (sync?: boolean) => Player[] | undefined;
  getInstanceList: (sync?: boolean) => InstanceSummary[] | undefined;
  getAuthServerList: (sync?: boolean) => AuthServer[] | undefined;
}

// for frontend-only state update
interface GlobalDataDispatchContextType {
  setPlayerList: React.Dispatch<Player[]>;
  setSelectedPlayer: React.Dispatch<Player | undefined>;
  setInstanceList: React.Dispatch<InstanceSummary[]>;
  setSelectedInstance: React.Dispatch<InstanceSummary | undefined>;
  setAuthServerList: React.Dispatch<AuthServer[]>;
}

const GlobalDataContext = createContext<GlobalDataContextType | undefined>(
  undefined
);

const GlobalDataDispatchContext = createContext<
  GlobalDataDispatchContextType | undefined
>(undefined);

export const GlobalDataContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { config } = useLauncherConfig();
  const toast = useToast();

  const [playerList, setPlayerList] = useState<Player[]>();
  const [selectedPlayer, setSelectedPlayer] = useState<Player>();
  const [instanceList, setInstanceList] = useState<InstanceSummary[]>();
  const [selectedInstance, setSelectedInstance] = useState<InstanceSummary>();
  const [authServerList, setAuthServerList] = useState<AuthServer[]>();

  useEffect(() => {
    const selectedPlayerId = config.states.shared.selectedPlayerId;
    setSelectedPlayer(
      playerList?.find((player) => player.id === selectedPlayerId)
    );
  }, [playerList, config.states.shared.selectedPlayerId]);

  useEffect(() => {
    const selectedInstanceId = config.states.shared.selectedInstanceId;
    setSelectedInstance(
      instanceList?.find((instance) => instance.id === selectedInstanceId)
    );
  }, [instanceList, config.states.shared.selectedInstanceId]);

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
      if (response.status === "success") setInstanceList(response.data);
      else
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
    });
  }, [setInstanceList, toast]);

  const getPlayerList = useGetState(playerList, handleRetrievePlayerList);

  const getInstanceList = useGetState(
    // put starred instances at the top
    instanceList
      ? [...instanceList].sort((a, b) => Number(b.starred) - Number(a.starred))
      : undefined,
    handleRetrieveInstanceList
  );

  const getAuthServerList = useGetState(
    authServerList,
    handleRetrieveAuthServerList
  );

  return (
    <GlobalDataContext.Provider
      value={{
        selectedPlayer,
        selectedInstance,
        getPlayerList,
        getInstanceList,
        getAuthServerList,
      }}
    >
      <GlobalDataDispatchContext.Provider
        value={{
          setPlayerList,
          setSelectedPlayer,
          setInstanceList,
          setSelectedInstance,
          setAuthServerList,
        }}
      >
        {children}
      </GlobalDataDispatchContext.Provider>
    </GlobalDataContext.Provider>
  );
};

export const useGlobalData = (): GlobalDataContextType => {
  const context = useContext(GlobalDataContext);
  if (!context) {
    throw new Error(
      "useGlobalData must be used within a GlobalDataContextProvider"
    );
  }
  return context;
};

export const useGlobalDataDispatch = (): GlobalDataDispatchContextType => {
  const context = useContext(GlobalDataDispatchContext);
  if (!context) {
    throw new Error(
      "useGlobalDataDispatch must be used within a GlobalDataContextProvider"
    );
  }
  return context;
};

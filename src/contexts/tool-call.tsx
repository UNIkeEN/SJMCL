import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { LauncherConfig } from "@/models/config";

export interface ToolExecutionContextData {
  config: LauncherConfig;
  t: (key: string) => string;
  openSharedModal: (key: string, params?: any) => void;
  getGameVersionList: () => Promise<any>;
}

export interface ToolCallState {
  result: string | null;
  error: string | null;
  isExecuting: boolean;
}

export const ToolExecutionContext =
  createContext<ToolExecutionContextData | null>(null);

export const ToolExecutionActionsContext = createContext<
  | {
      setToolExecutionContext: (context: ToolExecutionContextData) => void;
      clearToolExecutionContext: () => void;
    }
  | undefined
>(undefined);

export const ToolCallStateContext = createContext<
  Record<string, ToolCallState> | undefined
>(undefined);

export const ToolCallActionsContext = createContext<
  | {
      setToolCallState: (id: string, state: ToolCallState) => void;
      getToolCallState: (id: string) => ToolCallState;
      hasExecutingToolCall: () => boolean;
    }
  | undefined
>(undefined);

export const ToolCallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toolExecutionContext, setToolExecutionContextState] =
    useState<ToolExecutionContextData | null>(null);

  const [toolCallStates, setToolCallStates] = useState<
    Record<string, ToolCallState>
  >({});

  // Use a ref to store state for synchronous access and stable callbacks
  const toolCallStatesRef = useRef(toolCallStates);

  const setToolCallState = useCallback((id: string, state: ToolCallState) => {
    // Update ref immediately for synchronous logic
    toolCallStatesRef.current = { ...toolCallStatesRef.current, [id]: state };
    // Trigger re-render
    setToolCallStates((prev) => ({
      ...prev,
      [id]: state,
    }));
  }, []);

  const getToolCallState = useCallback((id: string) => {
    return (
      toolCallStatesRef.current[id] || {
        result: null,
        error: null,
        isExecuting: false,
      }
    );
  }, []);

  const hasExecutingToolCall = useCallback(() => {
    return Object.values(toolCallStatesRef.current).some(
      (state) => state.isExecuting
    );
  }, []);

  const setToolExecutionContext = useCallback(
    (context: ToolExecutionContextData) => {
      setToolExecutionContextState(context);
    },
    []
  );

  const clearToolExecutionContext = useCallback(() => {
    setToolExecutionContextState(null);
  }, []);

  return (
    <ToolExecutionActionsContext.Provider
      value={{ setToolExecutionContext, clearToolExecutionContext }}
    >
      <ToolExecutionContext.Provider value={toolExecutionContext}>
        <ToolCallActionsContext.Provider
          value={{ setToolCallState, getToolCallState, hasExecutingToolCall }}
        >
          <ToolCallStateContext.Provider value={toolCallStates}>
            {children}
          </ToolCallStateContext.Provider>
        </ToolCallActionsContext.Provider>
      </ToolExecutionContext.Provider>
    </ToolExecutionActionsContext.Provider>
  );
};

export const useToolExecutionContext = () => {
  return useContext(ToolExecutionContext);
};

export const useToolExecutionContextActions = () => {
  const context = useContext(ToolExecutionActionsContext);
  if (context === undefined) {
    throw new Error(
      "useToolExecutionContextActions must be used within a ToolCallProvider"
    );
  }
  return context;
};

export const useToolCallState = () => {
  const context = useContext(ToolCallStateContext);
  if (context === undefined) {
    throw new Error("useToolCallState must be used within a ToolCallProvider");
  }
  return context;
};

export const useToolCallActions = () => {
  const context = useContext(ToolCallActionsContext);
  if (context === undefined) {
    throw new Error(
      "useToolCallActions must be used within a ToolCallProvider"
    );
  }
  return context;
};

export const useToolCall = () => {
  return {
    toolCallStates: useToolCallState(),
    ...useToolCallActions(),
  };
};

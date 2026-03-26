import React, { createContext, useContext, useState } from "react";

export interface FunctionCallState {
  result: string | null;
  error: string | null;
  isExecuting: boolean;
}

export const FunctionCallStateContext = createContext<
  Record<string, FunctionCallState> | undefined
>(undefined);

export const FunctionCallActionsContext = createContext<
  | {
      setCallState: (id: string, state: FunctionCallState) => void;
      getCallState: (id: string) => FunctionCallState;
      hasExecutingCall: () => boolean;
    }
  | undefined
>(undefined);

export const FunctionCallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [callStates, setCallStates] = useState<
    Record<string, FunctionCallState>
  >({});

  // Use a ref to store state for synchronous access and stable callbacks
  const callStatesRef = React.useRef(callStates);

  const setCallState = React.useCallback(
    (id: string, state: FunctionCallState) => {
      // Update ref immediately for synchronous logic
      callStatesRef.current = { ...callStatesRef.current, [id]: state };
      // Trigger re-render
      setCallStates((prev) => ({
        ...prev,
        [id]: state,
      }));
    },
    []
  );

  const getCallState = React.useCallback((id: string) => {
    return (
      callStatesRef.current[id] || {
        result: null,
        error: null,
        isExecuting: false,
      }
    );
  }, []);

  const hasExecutingCall = React.useCallback(() => {
    return Object.values(callStatesRef.current).some(
      (state) => state.isExecuting
    );
  }, []);

  return (
    <FunctionCallActionsContext.Provider
      value={{ setCallState, getCallState, hasExecutingCall }}
    >
      <FunctionCallStateContext.Provider value={callStates}>
        {children}
      </FunctionCallStateContext.Provider>
    </FunctionCallActionsContext.Provider>
  );
};

export const useFunctionCallState = () => {
  const context = useContext(FunctionCallStateContext);
  if (context === undefined) {
    throw new Error(
      "useFunctionCallState must be used within a FunctionCallProvider"
    );
  }
  return context;
};

export const useFunctionCallActions = () => {
  const context = useContext(FunctionCallActionsContext);
  if (context === undefined) {
    throw new Error(
      "useFunctionCallActions must be used within a FunctionCallProvider"
    );
  }
  return context;
};

export const useFunctionCall = () => {
  return {
    callStates: useFunctionCallState(),
    ...useFunctionCallActions(),
  };
};

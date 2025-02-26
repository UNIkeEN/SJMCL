import { useCallback } from "react";

export function useGetState<T>(
  state: T | undefined,
  retrieveHandler: () => void
): (sync?: boolean) => T | undefined {
  const getState = useCallback(
    (sync = false) => {
      if (sync || state === undefined) retrieveHandler();
      return state;
    },
    [state, retrieveHandler]
  );

  return getState;
}

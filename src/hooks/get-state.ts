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

export function usePromisedGetState<T>(
  state: T | undefined,
  retrieveHandler: () => Promise<any>
): (sync?: boolean) => Promise<T | undefined> {
  const getState = useCallback(
    async (sync = false) => {
      if (sync || state === undefined) {
        const data = await retrieveHandler();
        return data;
      } else return state;
    },
    [state, retrieveHandler]
  );

  return getState;
}

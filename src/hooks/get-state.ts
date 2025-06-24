import { useCallback, useState } from "react";

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
): [(sync?: boolean) => Promise<T | undefined>, boolean] {
  const [isLoading, setIsLoading] = useState(false);
  const getState = useCallback(
    async (sync = false) => {
      if (sync || state === undefined) {
        setIsLoading(true);
        try {
          const data = await retrieveHandler();
          return data;
        } catch (_) {
          return undefined;
        } finally {
          setIsLoading(false);
        }
      } else return state;
    },
    [state, retrieveHandler]
  );

  return [getState, isLoading];
}

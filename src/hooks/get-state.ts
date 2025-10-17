import { useCallback, useRef, useState } from "react";

export enum GetStateFlag {
  Cancelled = "%CANCELLED%",
}

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
  versionRef: React.MutableRefObject<string | undefined>,
  retrieveHandler: () => Promise<any>
): [(sync?: boolean) => Promise<T | GetStateFlag | undefined>, boolean] {
  const [isLoading, setIsLoading] = useState(false);
  const validVersion = useRef<string | undefined>(undefined);
  const isBusy = isLoading || versionRef.current !== validVersion.current;
  const getState = useCallback(
    async (sync = false) => {
      if (
        sync ||
        state === undefined ||
        validVersion.current !== versionRef.current
      ) {
        setIsLoading(true);
        try {
          const data = await retrieveHandler();
          validVersion.current = versionRef.current;
          return data;
        } catch (_) {
          return undefined;
        } finally {
          setIsLoading(false);
        }
      } else return state;
    },
    [state, versionRef, retrieveHandler]
  );
  return [getState, isBusy];
}

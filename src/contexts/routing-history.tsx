import { useRouter } from "next/router";
import React, { createContext, useContext, useEffect, useState } from "react";

type RoutingHistoryContextType = {
  history: string[];
  removeHistory: (prefix: string) => void;
};

const RoutingHistoryContext = createContext<
  RoutingHistoryContextType | undefined
>(undefined);

export const RoutingHistoryContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [history, setHistory] = useState<string[]>([]);

  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (route: string) => {
      setHistory((prev) => {
        if (prev[prev.length - 1] === route) {
          return prev;
        }
        return [...prev, route];
      });
    };

    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

  const removeHistory = (prefix: string) => {
    setHistory((prev) => prev.filter((route) => !route.startsWith(prefix)));
  };

  return (
    <RoutingHistoryContext.Provider value={{ history, removeHistory }}>
      {children}
    </RoutingHistoryContext.Provider>
  );
};

export const useRoutingHistory = (): RoutingHistoryContextType => {
  const context = useContext(RoutingHistoryContext);
  if (!context) {
    throw new Error(
      "useRoutingHistory must be used within a RoutingHistoryContextProvider"
    );
  }
  return context;
};

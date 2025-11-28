import { ChakraProvider } from "@chakra-ui/react";
import i18n from "i18next";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import React, { useEffect, useMemo } from "react";
import { initReactI18next } from "react-i18next";
import { Fade } from "@/components/common/transition";
import GlobalEventHandler from "@/components/special/global-event-handler";
import { GuidedTourProvider } from "@/components/special/guided-tour-provider";
import SharedModalsProvider from "@/components/special/shared-modals-provider";
import { LauncherConfigContextProvider } from "@/contexts/config";
import { GlobalDataContextProvider } from "@/contexts/global-data";
import { RoutingHistoryContextProvider } from "@/contexts/routing-history";
import { TaskContextProvider } from "@/contexts/task";
import { ToastContextProvider } from "@/contexts/toast";
import InstanceDetailsLayout from "@/layouts/instance-details-layout";
import InstancesLayout from "@/layouts/instances-layout";
import MainLayout from "@/layouts/main-layout";
import SettingsLayout from "@/layouts/settings-layout";
import { localeResources } from "@/locales";
import chakraExtendTheme from "@/styles/chakra-theme";
import "@/styles/globals.css";
import { isProd } from "@/utils/env";
import { setupLogger } from "@/utils/logging";

i18n.use(initReactI18next).init({
  resources: localeResources,
  fallbackLng: "en",
  lng: "zh-Hans",
  interpolation: {
    escapeValue: false,
  },
});

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    // setup global logger
    setupLogger();

    // forbid right mouse menu of webview
    if (isProd) {
      document.addEventListener("contextmenu", (event) => {
        event.preventDefault();
      });
    }

    // forbid keyboard shortcut in webview: https://github.com/UNIkeEN/SJMCL/issues/163
    document.addEventListener("keydown", (event) => {
      const disabledShortcuts =
        ["F3", "F5", "F7"].includes(event.key) ||
        (event.shiftKey && event.key === "Escape") || // forbid Edge task manager
        (event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) ||
        (event.ctrlKey && ["H", "Q"].includes(event.key.toUpperCase())) ||
        ((event.ctrlKey || event.metaKey) &&
          ["F", "G", "J", "P", "R", "U"].includes(event.key.toUpperCase()));
      disabledShortcuts && event.preventDefault();
    });
  }, []);

  const layoutKeyMappings: {
    prefix: string;
    key: string;
  }[] = useMemo(
    () => [
      { prefix: "/settings", key: "settings" },
      {
        prefix: "/instances/details",
        key: "instances-details",
      },
      { prefix: "/instances", key: "instances" },
    ],
    []
  );

  const layoutMappings: Record<
    string,
    React.ComponentType<{ children: React.ReactNode }>[]
  > = useMemo(
    () => ({
      settings: [SettingsLayout],
      "instances-details": [InstancesLayout, InstanceDetailsLayout],
      instances: [InstancesLayout],
    }),
    []
  ); // not nest MainLayout to avoid tab flashing

  let layoutKey = useMemo(() => {
    for (const mapping of layoutKeyMappings) {
      if (router.pathname.startsWith(mapping.prefix)) {
        return mapping.key;
      }
    }
    return "default"; // default layout
  }, [router.pathname, layoutKeyMappings]);

  let SpecLayout: React.FC<{ children: React.ReactNode }> = useMemo(() => {
    const layout = layoutMappings[layoutKey];
    if (layout) {
      return ({ children }) =>
        layout.reduceRight(
          (nestedChildren, Layout) => <Layout>{nestedChildren}</Layout>,
          children
        );
    }
    return function defaultLayout({ children }: { children: React.ReactNode }) {
      return <>{children}</>;
    }; // default layout
  }, [layoutKey, layoutMappings]);
  // use layoutKey as a dependency to ensure SpecLayout remains stable
  // when switching tabs in game instance page
  // see https://github.com/UNIkeEN/SJMCL/pull/491

  return (
    <ChakraProvider theme={chakraExtendTheme}>
      <ToastContextProvider>
        <RoutingHistoryContextProvider>
          <LauncherConfigContextProvider>
            <GlobalDataContextProvider>
              <GuidedTourProvider>
                <SharedModalsProvider>
                  <TaskContextProvider>
                    <GlobalEventHandler>
                      <MainLayout>
                        <Fade key={router.pathname.split("/")[1] || ""} in>
                          <SpecLayout>
                            <Component {...pageProps} />
                          </SpecLayout>
                        </Fade>
                      </MainLayout>
                    </GlobalEventHandler>
                  </TaskContextProvider>
                </SharedModalsProvider>
              </GuidedTourProvider>
            </GlobalDataContextProvider>
          </LauncherConfigContextProvider>
        </RoutingHistoryContextProvider>
      </ToastContextProvider>
    </ChakraProvider>
  );
}

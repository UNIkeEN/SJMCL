import { ChakraProvider } from "@chakra-ui/react";
import i18n from "i18next";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import React, { useEffect } from "react";
import { initReactI18next } from "react-i18next";
import { Fade } from "@/components/common/transition";
import GlobalEventHandler from "@/components/special/global-event-handler";
import SharedModalsProvider from "@/components/special/shared-modals-provider";
import { LauncherConfigContextProvider } from "@/contexts/config";
import { GlobalDataContextProvider } from "@/contexts/global-data";
import { RoutingHistoryContextProvider } from "@/contexts/routing-history";
import { ToastContextProvider } from "@/contexts/toast";
import InstanceDetailsLayout from "@/layouts/instance-details-layout";
import InstancesLayout from "@/layouts/instances-layout";
import MainLayout from "@/layouts/main-layout";
import SettingsLayout from "@/layouts/settings-layout";
import { localeResources } from "@/locales";
import chakraExtendTheme from "@/styles/chakra-theme";
import "@/styles/globals.css";
import { isProd } from "@/utils/env";

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
        (event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) ||
        ((event.ctrlKey || event.metaKey) &&
          ["F", "G", "H", "J", "P", "Q", "R", "U"].includes(
            event.key.toUpperCase()
          ));
      disabledShortcuts && event.preventDefault();
    });
  }, []);

  const layoutMappings: {
    prefix: string;
    layouts: React.ComponentType<{ children: React.ReactNode }>[];
  }[] = [
    { prefix: "/settings", layouts: [SettingsLayout] },
    {
      prefix: "/instances/details",
      layouts: [InstancesLayout, InstanceDetailsLayout],
    },
    { prefix: "/instances", layouts: [InstancesLayout] },
  ]; // not nest MainLayout to avoid tab flashing

  let SpecLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <>{children}</>
  );

  for (const mapping of layoutMappings) {
    if (router.pathname.startsWith(mapping.prefix)) {
      SpecLayout = ({ children }) =>
        mapping.layouts.reduceRight(
          (nestedChildren, Layout) => <Layout>{nestedChildren}</Layout>,
          children
        );
      break;
    }
  }

  return (
    <ChakraProvider theme={chakraExtendTheme}>
      <ToastContextProvider>
        <RoutingHistoryContextProvider>
          <LauncherConfigContextProvider>
            <GlobalDataContextProvider>
              <SharedModalsProvider>
                <GlobalEventHandler>
                  <MainLayout>
                    <Fade key={router.pathname.split("/")[1] || ""} in>
                      <SpecLayout>
                        <Component {...pageProps} />
                      </SpecLayout>
                    </Fade>
                  </MainLayout>
                </GlobalEventHandler>
              </SharedModalsProvider>
            </GlobalDataContextProvider>
          </LauncherConfigContextProvider>
        </RoutingHistoryContextProvider>
      </ToastContextProvider>
    </ChakraProvider>
  );
}

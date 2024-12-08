import { ChakraProvider } from "@chakra-ui/react";
import i18n from "i18next";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import React, { useEffect } from "react";
import { initReactI18next } from "react-i18next";
import chakraExtendTheme from "@/chakra-theme";
import { Fade } from "@/components/common/transition";
import { LauncherConfigContextProvider } from "@/contexts/config";
import { DataContextProvider } from "@/contexts/data";
import { RoutingHistoryContextProvider } from "@/contexts/routing-history";
import { ToastContextProvider } from "@/contexts/toast";
import GamesLayout from "@/layouts/games-layout";
import MainLayout from "@/layouts/main-layout";
import SettingsLayout from "@/layouts/settings-layout";
import { localeResources } from "@/locales";
import "@/styles/globals.css";
import { isProd } from "@/utils/env";

i18n.use(initReactI18next).init({
  resources: localeResources,
  fallbackLng: "zh-Hans",
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
  }, []);

  const layoutMappings: {
    prefix: string;
    layout: React.ComponentType<{ children: React.ReactNode }>;
  }[] = [
    { prefix: "/settings/", layout: SettingsLayout },
    { prefix: "/games", layout: GamesLayout },
  ];

  let SpecLayout: React.ComponentType<{ children: React.ReactNode }> =
    React.Fragment;

  for (const mapping of layoutMappings) {
    if (router.pathname.startsWith(mapping.prefix)) {
      SpecLayout = mapping.layout;
      break;
    }
  }

  return (
    <ChakraProvider theme={chakraExtendTheme}>
      <ToastContextProvider>
        <RoutingHistoryContextProvider>
          <LauncherConfigContextProvider>
            <DataContextProvider>
              <MainLayout>
                <Fade key={router.pathname.split("/")[1] || ""} in>
                  <SpecLayout>
                    <Component {...pageProps} />
                  </SpecLayout>
                </Fade>
              </MainLayout>
            </DataContextProvider>
          </LauncherConfigContextProvider>
        </RoutingHistoryContextProvider>
      </ToastContextProvider>
    </ChakraProvider>
  );
}

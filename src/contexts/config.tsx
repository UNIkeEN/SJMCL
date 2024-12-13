import i18n from "i18next";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/contexts/toast";
import { LauncherConfig, defaultConfig } from "@/models/config";
import { getLauncherConfig, updateLauncherConfig } from "@/services/config";

interface LauncherConfigContextType {
  config: LauncherConfig;
  update: (path: string, value: any) => void;
}

const LauncherConfigContext = createContext<
  LauncherConfigContextType | undefined
>(undefined);

export const LauncherConfigContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [config, setConfig] = useState<LauncherConfig>(defaultConfig);
  const { t } = useTranslation();
  const toast = useToast();

  useEffect(() => {
    getLauncherConfig()
      .then((config) => {
        setConfig(config);
      })
      .catch((error) => {
        toast({
          title: t("Services.config.getLauncherConfig.error"),
          status: "error",
        });
      });
  }, [toast, t]);

  useEffect(() => {
    i18n.changeLanguage(config.general.general.language);
  }, [config.general.general.language]);

  const updateByKeyPath = (obj: any, path: string, value: any): void => {
    const keys = path.split(".");
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]] = value;
  };

  const update = (path: string, value: any) => {
    const newConfig = { ...config };
    updateByKeyPath(newConfig, path, value);

    // Save to the backend
    updateLauncherConfig(path, value)
      .then(() => {
        setConfig(newConfig); // update frontend state if successful
      })
      .catch((error) => {
        toast({
          title: t("Services.config.updateLauncherConfig.error"),
          status: "error",
        });
      });
  };

  return (
    <LauncherConfigContext.Provider value={{ config, update }}>
      {children}
    </LauncherConfigContext.Provider>
  );
};

export const useLauncherConfig = (): LauncherConfigContextType => {
  const context = useContext(LauncherConfigContext);
  if (!context) {
    throw new Error(
      "useLauncherConfig must be used within a LauncherConfigContextProvider"
    );
  }
  return context;
};

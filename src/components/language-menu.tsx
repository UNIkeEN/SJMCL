import { MenuProps } from "@chakra-ui/react";
import React from "react";
import { MenuSelector } from "@/components/common/menu-selector";
import { useLauncherConfig } from "@/contexts/config";
import { localeResources } from "@/locales";

const LanguageMenu: React.FC<Omit<MenuProps, "children">> = ({ ...props }) => {
  const { config, update } = useLauncherConfig();
  const currentLanguage = config.general.general.language;

  return (
    <MenuSelector
      {...props}
      value={currentLanguage}
      onSelect={(value) => {
        if (typeof value === "string") {
          update("general.general.language", value);
        }
      }}
      options={Object.entries(localeResources).map(([key, val]) => ({
        value: key,
        label: val.display_name,
      }))}
      size="xs"
      buttonProps={{
        flex: "0 0 auto",
      }}
    />
  );
};

export default LanguageMenu;

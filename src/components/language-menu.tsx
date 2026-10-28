import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MenuSelector } from "@/components/common/menu-selector";
import { useLauncherConfig } from "@/contexts/config";
import { localeResources } from "@/locales";

const LanguageMenu: React.FC<{ placement?: "top" | "bottom" }> = ({
  placement,
}) => {
  const { config, update } = useLauncherConfig();
  const currentLanguage = config.general.general.language;
  const { t } = useTranslation();

  const options = useMemo(
    () =>
      Object.entries(localeResources).map(([key, val]) => {
        const translatedName = t(`LanguageMenu.localeName.${key}`, "");
        return {
          value: key,
          label:
            translatedName && translatedName !== val.display_name
              ? `${translatedName} - ${val.display_name}`
              : val.display_name,
        };
      }),
    [t]
  );

  return (
    <MenuSelector
      placement={placement}
      value={currentLanguage}
      onSelect={(value) => {
        if (typeof value === "string") {
          update("general.general.language", value);
        }
      }}
      options={options}
      size="xs"
    />
  );
};

export default LanguageMenu;

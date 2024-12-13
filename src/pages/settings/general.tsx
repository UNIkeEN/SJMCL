// @ts-nocheck
import {
  Button,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Switch,
} from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown } from "react-icons/lu";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { localeResources } from "@/locales";

const GeneralSettingsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const generalConfigs = config.general;
  const primaryColor = config.appearance.theme.primaryColor;

  const LocaleMenu = () => {
    const currentLanguage = generalConfigs.general.language;

    return (
      <Menu>
        <MenuButton
          as={Button}
          size="xs"
          w="auto"
          rightIcon={<LuChevronDown />}
          variant="outline"
          textAlign="left"
        >
          {localeResources[currentLanguage]?.display_name}
        </MenuButton>
        <MenuList>
          <MenuOptionGroup
            defaultValue={currentLanguage}
            type="radio"
            onChange={(value) => {
              update("general.general.language", value);
            }}
          >
            {Object.keys(localeResources).map((key) => (
              <MenuItemOption key={key} value={key} fontSize="xs">
                {localeResources[key].display_name}
              </MenuItemOption>
            ))}
          </MenuOptionGroup>
        </MenuList>
      </Menu>
    );
  };

  const generalSettingGroups: OptionItemGroupProps[] = [
    {
      title: t("GeneralSettingsPage.general.title"),
      items: [
        {
          title: t("GeneralSettingsPage.general.settings.language.title"),
          children: <LocaleMenu />,
        },
      ],
    },
    {
      title: t("GeneralSettingsPage.functions.title"),
      items: [
        {
          title: t("GeneralSettingsPage.functions.settings.discover.title"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={generalConfigs.optionalFunctions.discover}
              onChange={(e) => {
                update("general.optionalFunctions.discover", e.target.checked);
              }}
            />
          ),
        },
      ],
    },
  ];

  return (
    <>
      {generalSettingGroups.map((group, index) => (
        <OptionItemGroup title={group.title} items={group.items} key={index} />
      ))}
    </>
  );
};

export default GeneralSettingsPage;

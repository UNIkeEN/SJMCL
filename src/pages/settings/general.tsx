import { Kbd, Switch, Text, useDisclosure } from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import LanguageMenu from "@/components/language-menu";
import GenericConfirmDialog from "@/components/modals/generic-confirm-dialog";
import { useLauncherConfig } from "@/contexts/config";

const GeneralSettingsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const generalConfigs = config.general;
  const primaryColor = config.appearance.theme.primaryColor;

  const {
    isOpen: isDiscoverNoticeDialogOpen,
    onOpen: onDiscoverNoticeDialogOpen,
    onClose: onDiscoverNoticeDialogClose,
  } = useDisclosure();

  const generalSettingGroups: OptionItemGroupProps[] = [
    {
      title: t("GeneralSettingsPage.general.title"),
      items: [
        {
          title: t("GeneralSettingsPage.general.settings.language.title"),
          children: <LanguageMenu />,
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
                if (e.target.checked) {
                  onDiscoverNoticeDialogOpen();
                }
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
      <GenericConfirmDialog
        isOpen={isDiscoverNoticeDialogOpen}
        onClose={onDiscoverNoticeDialogClose}
        title={t("General.notice")}
        body={
          <Text>
            {t(
              "GeneralSettingsPage.functions.settings.discover.openNotice.part-1"
            )}
            <Kbd>
              {t(
                `Enums.${config.basicInfo.osType === "macos" ? "metaKey" : "ctrlKey"}.${config.basicInfo.osType}`
              )}
            </Kbd>
            {" + "}
            <Kbd>S</Kbd>
            {t(
              "GeneralSettingsPage.functions.settings.discover.openNotice.part-2"
            )}
          </Text>
        }
        btnOK={t("General.confirm")}
        btnCancel=""
        onOKCallback={onDiscoverNoticeDialogClose}
      />
    </>
  );
};

export default GeneralSettingsPage;

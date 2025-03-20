import { Badge, Kbd, Switch, Text, useDisclosure } from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import SegmentedControl from "@/components/common/segmented";
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

  const instancesNavTypes = ["instance", "directory"];

  const generalSettingGroups: OptionItemGroupProps[] = [
    {
      title: t("GeneralSettingsPage.general.title"),
      items: [
        {
          title: t("GeneralSettingsPage.general.settings.language.title"),
          description: t(
            "GeneralSettingsPage.general.settings.language.communityAck"
          ),
          children: <LanguageMenu />,
        },
      ],
    },
    {
      title: t("GeneralSettingsPage.functions.title"),
      items: [
        {
          title: t("GeneralSettingsPage.functions.settings.discoverPage.title"),
          titleExtra: <Badge colorScheme="purple">Beta</Badge>,
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={generalConfigs.functionality.discoverPage}
              onChange={(e) => {
                update("general.functionality.discoverPage", e.target.checked);
                if (e.target.checked) {
                  onDiscoverNoticeDialogOpen();
                }
              }}
            />
          ),
        },
      ],
    },
    {
      items: [
        {
          title: t(
            "GeneralSettingsPage.functions.settings.instancesNavType.title"
          ),
          children: (
            <SegmentedControl
              selected={generalConfigs.functionality.instancesNavType}
              onSelectItem={(s) => {
                update("general.functionality.instancesNavType", s as string);
              }}
              size="xs"
              items={instancesNavTypes.map((s) => ({
                label: t(
                  `GeneralSettingsPage.functions.settings.instancesNavType.${s}`
                ),
                value: s,
              }))}
            />
          ),
        },
        {
          title: t(
            "GeneralSettingsPage.functions.settings.launchPageQuickSwitch.title"
          ),
          description: t(
            "GeneralSettingsPage.functions.settings.launchPageQuickSwitch.description"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={generalConfigs.functionality.launchPageQuickSwitch}
              onChange={(e) => {
                update(
                  "general.functionality.launchPageQuickSwitch",
                  e.target.checked
                );
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
              "GeneralSettingsPage.functions.settings.discoverPage.openNotice.part-1"
            )}
            <Kbd>
              {t(
                `Enums.${config.basicInfo.osType === "macos" ? "metaKey" : "ctrlKey"}.${config.basicInfo.osType}`
              )}
            </Kbd>
            {" + "}
            <Kbd>S</Kbd>
            {t(
              "GeneralSettingsPage.functions.settings.discoverPage.openNotice.part-2"
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

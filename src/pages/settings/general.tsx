import { Badge, Button, Kbd, Switch, Text } from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import { MenuSelector } from "@/components/common/menu-selector";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import LanguageMenu from "@/components/language-menu";
import { useLauncherConfig } from "@/contexts/config";
import { useRoutingHistory } from "@/contexts/routing-history";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { ConfigService } from "@/services/config";

const GeneralSettingsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config, update } = useLauncherConfig();
  const generalConfigs = config.general;
  const primaryColor = config.appearance.theme.primaryColor;
  const { removeHistory } = useRoutingHistory();
  const { openGenericConfirmDialog, closeSharedModal } = useSharedModals();

  const instancesNavTypes = ["instance", "directory", "hidden"];

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
                  openGenericConfirmDialog({
                    title: t("General.notice"),
                    body: (
                      <Text>
                        {t(
                          "GeneralSettingsPage.functions.settings.discoverPage.openNotice.part-1"
                        )}
                        <Kbd>
                          {t(
                            `Enums.${
                              config.basicInfo.osType === "macos"
                                ? "metaKey"
                                : "ctrlKey"
                            }.${config.basicInfo.osType}`
                          )}
                        </Kbd>
                        {" + "}
                        <Kbd>S</Kbd>
                        {t(
                          "GeneralSettingsPage.functions.settings.discoverPage.openNotice.part-2"
                        )}
                      </Text>
                    ),
                    btnCancel: "",
                    onOKCallback: () => {
                      closeSharedModal("generic-confirm");
                    },
                  });
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
          description: t(
            "GeneralSettingsPage.functions.settings.instancesNavType.description"
          ),
          children: (
            <MenuSelector
              options={instancesNavTypes.map((type) => ({
                value: type,
                label: t(
                  `GeneralSettingsPage.functions.settings.instancesNavType.${type}`
                ),
              }))}
              value={generalConfigs.functionality.instancesNavType}
              onSelect={(value) => {
                update(
                  "general.functionality.instancesNavType",
                  value as string
                );
                removeHistory("/instances");
              }}
              placeholder={t(
                `GeneralSettingsPage.functions.settings.instancesNavType.${generalConfigs.functionality.instancesNavType}`
              )}
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
    ...(config.general.general.language == "zh-Hans"
      ? [
          {
            items: [
              {
                title: t(
                  "GeneralSettingsPage.functions.settings.resourceTranslation.title"
                ),
                description: t(
                  "GeneralSettingsPage.functions.settings.resourceTranslation.description"
                ),
                children: (
                  <Switch
                    colorScheme={primaryColor}
                    isChecked={generalConfigs.functionality.resourceTranslation}
                    onChange={(e) => {
                      update(
                        "general.functionality.resourceTranslation",
                        e.target.checked
                      );
                    }}
                  />
                ),
              },
              {
                title: t(
                  "GeneralSettingsPage.functions.settings.skipFirstScreenOptions.title"
                ),
                description: t(
                  "GeneralSettingsPage.functions.settings.skipFirstScreenOptions.description"
                ),
                children: (
                  <Switch
                    colorScheme={primaryColor}
                    isChecked={
                      generalConfigs.functionality.skipFirstScreenOptions
                    }
                    onChange={(e) => {
                      update(
                        "general.functionality.skipFirstScreenOptions",
                        e.target.checked
                      );
                    }}
                  />
                ),
              },
            ],
          },
        ]
      : []),
    {
      title: t("GeneralSettingsPage.advanced.title"),
      items: [
        {
          title: t(
            "GeneralSettingsPage.advanced.settings.openConfigJson.title"
          ),
          description: t(
            "GeneralSettingsPage.advanced.settings.openConfigJson.description",
            { opener: t(`Enums.systemFileManager.${config.basicInfo.osType}`) }
          ),
          children: (
            <Button
              variant="subtle"
              size="xs"
              onClick={() =>
                openGenericConfirmDialog({
                  title: t("General.notice"),
                  body: t("RevealConfigJsonConfirmDialog.body"),
                  btnOK: t("General.confirm"),
                  showSuppressBtn: true,
                  suppressKey: "openConfigJson",
                  onOKCallback: () => {
                    ConfigService.revealLauncherConfig().then((response) => {
                      if (response.status !== "success") {
                        toast({
                          title: response.message,
                          description: response.details,
                          status: "error",
                        });
                      }
                    });
                  },
                })
              }
            >
              {t("GeneralSettingsPage.advanced.settings.openConfigJson.button")}
            </Button>
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

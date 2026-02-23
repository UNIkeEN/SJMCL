import { Button, Switch } from "@chakra-ui/react";
import { appLogDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import { LuLanguages } from "react-icons/lu";
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
    // Frontend grouping was modified after discussions in PR#1299
    // resulting in a mismatch with the backend storage structure. (TODO: migration?)
    {
      title: t("GeneralSettingsPage.language.title"),
      items: [
        {
          title: t("GeneralSettingsPage.language.settings.language.title"),
          description: t(
            "GeneralSettingsPage.language.settings.language.communityAck"
          ),
          prefixElement: <LuLanguages />,
          children: <LanguageMenu />,
        },
      ],
    },
    ...(config.general.general.language == "zh-Hans"
      ? [
          {
            items: [
              {
                title: t(
                  "GeneralSettingsPage.language.settings.resourceTranslation.title"
                ),
                description: t(
                  "GeneralSettingsPage.language.settings.resourceTranslation.description"
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
                  "GeneralSettingsPage.language.settings.translatedFilenamePrefix.title"
                ),
                description: t(
                  "GeneralSettingsPage.language.settings.translatedFilenamePrefix.description"
                ),
                children: (
                  <Switch
                    colorScheme={primaryColor}
                    isChecked={
                      generalConfigs.functionality.translatedFilenamePrefix
                    }
                    onChange={(e) => {
                      update(
                        "general.functionality.translatedFilenamePrefix",
                        e.target.checked
                      );
                    }}
                  />
                ),
              },
              {
                title: t(
                  "GeneralSettingsPage.language.settings.skipFirstScreenOptions.title"
                ),
                description: t(
                  "GeneralSettingsPage.language.settings.skipFirstScreenOptions.description"
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
      title: t("GeneralSettingsPage.functions.title"),
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
              buttonProps={{
                flex: "0 0 auto",
              }}
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
              {t("General.open")}
            </Button>
          ),
        },
        {
          title: t(
            "GeneralSettingsPage.advanced.settings.launcherLogDir.title"
          ),
          children: (
            <Button
              variant="subtle"
              size="xs"
              onClick={async () => {
                const _appLogDir = await appLogDir();
                openPath(_appLogDir + "/launcher");
              }}
            >
              {t("General.open")}
            </Button>
          ),
        },
        {
          title: t(
            "GeneralSettingsPage.advanced.settings.autoPurgeLauncherLogs.title"
          ),
          description: t(
            "GeneralSettingsPage.advanced.settings.autoPurgeLauncherLogs.description"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={generalConfigs.advanced.autoPurgeLauncherLogs}
              onChange={(e) => {
                update(
                  "general.advanced.autoPurgeLauncherLogs",
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
    </>
  );
};

export default GeneralSettingsPage;

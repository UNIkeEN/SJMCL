import {
  Badge,
  Button,
  Kbd,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Switch,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown } from "react-icons/lu";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import LanguageMenu from "@/components/language-menu";
import GenericConfirmDialog from "@/components/modals/generic-confirm-dialog";
import { useLauncherConfig } from "@/contexts/config";
import { useRoutingHistory } from "@/contexts/routing-history";

const GeneralSettingsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const generalConfigs = config.general;
  const primaryColor = config.appearance.theme.primaryColor;
  const { removeHistory } = useRoutingHistory();

  const {
    isOpen: isDiscoverNoticeDialogOpen,
    onOpen: onDiscoverNoticeDialogOpen,
    onClose: onDiscoverNoticeDialogClose,
  } = useDisclosure();

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
          description: t(
            "GeneralSettingsPage.functions.settings.instancesNavType.description"
          ),
          children: (
            <Menu>
              <MenuButton
                as={Button}
                size="xs"
                w="auto"
                rightIcon={<LuChevronDown />}
                variant="outline"
                textAlign="left"
              >
                {t(
                  `GeneralSettingsPage.functions.settings.instancesNavType.${generalConfigs.functionality.instancesNavType}`
                )}
              </MenuButton>
              <MenuList>
                <MenuOptionGroup
                  value={generalConfigs.functionality.instancesNavType}
                  type="radio"
                  onChange={(value) => {
                    update("general.functionality.instancesNavType", value);
                    removeHistory("/instances");
                  }}
                >
                  {instancesNavTypes.map((type) => (
                    <MenuItemOption value={type} fontSize="xs" key={type}>
                      {t(
                        `GeneralSettingsPage.functions.settings.instancesNavType.${type}`
                      )}
                    </MenuItemOption>
                  ))}
                </MenuOptionGroup>
              </MenuList>
            </Menu>
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

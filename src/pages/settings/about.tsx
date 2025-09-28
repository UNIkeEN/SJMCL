import {
  Avatar,
  AvatarGroup,
  Button,
  HStack,
  Icon,
  Text,
  useToast as useChakraToast,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRouter } from "next/router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowRight } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { TitleFullWithLogo } from "@/components/logo-title";
import { useLauncherConfig } from "@/contexts/config";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { CoreContributorsList } from "@/pages/settings/contributors";
import { isValidSemanticVersion } from "@/utils/string";

const AboutSettingsPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { close: closeToast } = useChakraToast();
  const { openSharedModal } = useSharedModals();

  const { config, newerVersion, handleCheckLauncherUpdate } =
    useLauncherConfig();
  const basicInfo = config.basicInfo;
  const primaryColor = config.appearance.theme.primaryColor;

  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const checkUpdate = useCallback(async () => {
    setCheckingUpdate(true);
    let checkingToast = toast({
      title: t("AboutSettingsPage.about.settings.version.checkToast.loading"),
      status: "loading",
    });
    const res = await handleCheckLauncherUpdate();
    closeToast(checkingToast);
    if (res.version === "up2date") {
      toast({
        title: t("AboutSettingsPage.about.settings.version.checkToast.up2date"),
        status: "success",
      });
    } else if (res.version === "") {
      toast({
        title: t("AboutSettingsPage.about.settings.version.checkToast.error"),
        status: "error",
      });
    } else openSharedModal("notify-new-version", { newVersion: res });
    setCheckingUpdate(false);
  }, [handleCheckLauncherUpdate, t, toast, closeToast, openSharedModal]);

  const aboutSettingGroups: OptionItemGroupProps[] = [
    {
      title: t("AboutSettingsPage.about.title"),
      items: [
        <TitleFullWithLogo key={0} />,
        {
          title: t("AboutSettingsPage.about.settings.version.title"),
          children: (
            <HStack>
              <Text fontSize="xs-sm" className="secondary-text">
                {`${basicInfo.launcherVersion}${basicInfo.isPortable ? " (Portable)" : ""}`}
              </Text>
              {isValidSemanticVersion(basicInfo.launcherVersion) && (
                <Button
                  variant="subtle"
                  colorScheme={newerVersion.version ? primaryColor : "gray"}
                  size="xs"
                  onClick={
                    newerVersion.version
                      ? () => {
                          openSharedModal("notify-new-version", {
                            newVersion: newerVersion,
                          });
                        }
                      : checkUpdate
                  }
                  isLoading={checkingUpdate}
                >
                  {newerVersion.version
                    ? t("AboutSettingsPage.about.settings.version.foundNew")
                    : t("AboutSettingsPage.about.settings.version.checkUpdate")}
                </Button>
              )}
            </HStack>
          ),
        },
        {
          title: t("AboutSettingsPage.about.settings.contributors.title"),
          children: (
            <HStack spacing={2.5}>
              <AvatarGroup size="xs" spacing={-2}>
                {CoreContributorsList.slice(0, 3).map((item) => (
                  <Avatar
                    key={item.username}
                    name={item.username}
                    src={`https://avatars.githubusercontent.com/${item.username}`}
                  />
                ))}
              </AvatarGroup>
              <Icon as={LuArrowRight} boxSize={3.5} mr="5px" />
            </HStack>
          ),
          isFullClickZone: true,
          onClick: () => router.push("/settings/contributors"),
        },
        {
          title: t("AboutSettingsPage.about.settings.reportIssue.title"),
          children: (
            <CommonIconButton
              label="https://github.com/UNIkeEN/SJMCL/issues"
              icon="external"
              withTooltip
              tooltipPlacement="bottom-end"
              size="xs"
              h={18}
              onClick={() => {
                openUrl("https://github.com/UNIkeEN/SJMCL/issues");
              }}
            />
          ),
        },
        {
          title: t("AboutSettingsPage.about.settings.aboutSJMC.title"),
          children: (
            <CommonIconButton
              label="https://mc.sjtu.cn/welcome/content/3/"
              icon="external"
              withTooltip
              tooltipPlacement="bottom-end"
              size="xs"
              h={18}
              onClick={() => {
                openUrl("https://mc.sjtu.cn/welcome/content/3/");
              }}
            />
          ),
        },
      ],
    },
    {
      title: t("AboutSettingsPage.ack.title"),
      items: [
        {
          title: t("AboutSettingsPage.ack.settings.skinview3d.title"),
          description: t(
            "AboutSettingsPage.ack.settings.skinview3d.description"
          ),
          children: (
            <CommonIconButton
              label="https://github.com/bs-community/skinview3d"
              icon="external"
              withTooltip
              tooltipPlacement="bottom-end"
              size="xs"
              onClick={() => {
                openUrl("https://github.com/bs-community/skinview3d");
              }}
            />
          ),
        },
        {
          title: t("AboutSettingsPage.ack.settings.bmclapi.title"),
          description: t("AboutSettingsPage.ack.settings.bmclapi.description"),
          children: (
            <CommonIconButton
              label="https://bmclapidoc.bangbang93.com/"
              icon="external"
              withTooltip
              tooltipPlacement="bottom-end"
              size="xs"
              onClick={() => {
                openUrl("https://bmclapidoc.bangbang93.com/");
              }}
            />
          ),
        },
        {
          title: t("AboutSettingsPage.ack.settings.hmcl.title"),
          description: t("AboutSettingsPage.ack.settings.hmcl.description"),
          children: (
            <CommonIconButton
              label="https://hmcl.huangyuhui.net/"
              icon="external"
              withTooltip
              tooltipPlacement="bottom-end"
              size="xs"
              onClick={() => {
                openUrl("https://hmcl.huangyuhui.net/");
              }}
            />
          ),
        },
        {
          title: t("AboutSettingsPage.ack.settings.littleskin.title"),
          description: t(
            "AboutSettingsPage.ack.settings.littleskin.description"
          ),
          children: (
            <CommonIconButton
              label="https://github.com/LittleSkinChina"
              icon="external"
              withTooltip
              tooltipPlacement="bottom-end"
              size="xs"
              onClick={() => {
                openUrl("https://github.com/LittleSkinChina");
              }}
            />
          ),
        },
        {
          title: t("AboutSettingsPage.ack.settings.sinter.title"),
          description: t("AboutSettingsPage.ack.settings.sinter.description"),
          children: (
            <CommonIconButton
              label="https://m.ui.cn/details/615564"
              icon="external"
              withTooltip
              tooltipPlacement="bottom-end"
              size="xs"
              onClick={() => {
                openUrl("https://m.ui.cn/details/615564");
              }}
            />
          ),
        },
      ],
    },
    {
      title: t("AboutSettingsPage.legalInfo.title"),
      items: [
        {
          title: t("AboutSettingsPage.legalInfo.settings.copyright.title"),
          description: t(
            "AboutSettingsPage.legalInfo.settings.copyright.description"
          ),
          children: <></>,
        },
        {
          title: t("AboutSettingsPage.legalInfo.settings.userAgreement.title"),
          children: (
            <CommonIconButton
              label={t(
                "AboutSettingsPage.legalInfo.settings.userAgreement.url"
              )}
              icon="external"
              withTooltip
              tooltipPlacement="bottom-end"
              size="xs"
              h={18}
              onClick={() => {
                openUrl(
                  t("AboutSettingsPage.legalInfo.settings.userAgreement.url")
                );
              }}
            />
          ),
        },
        {
          title: t(
            "AboutSettingsPage.legalInfo.settings.openSourceLicense.title"
          ),
          description: t(
            "AboutSettingsPage.legalInfo.settings.openSourceLicense.description"
          ),
          children: (
            <CommonIconButton
              label="https://github.com/UNIkeEN/SJMCL?tab=readme-ov-file#copyright"
              icon="external"
              withTooltip
              tooltipPlacement="bottom-end"
              size="xs"
              onClick={() => {
                openUrl(
                  "https://github.com/UNIkeEN/SJMCL?tab=readme-ov-file#copyright"
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
      {aboutSettingGroups.map((group, index) => (
        <OptionItemGroup title={group.title} items={group.items} key={index} />
      ))}
    </>
  );
};

export default AboutSettingsPage;

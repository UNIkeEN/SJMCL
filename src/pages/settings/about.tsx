import { Avatar, AvatarGroup, HStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import LinkIconButton from "@/components/common/link-icon-button";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { TitleFullWithLogo } from "@/components/logo-title";
import { useLauncherConfig } from "@/contexts/config";
import { CoreContributorsList } from "./contributors";

const AboutSettingsPage = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();

  const aboutSettingGroups: OptionItemGroupProps[] = [
    {
      title: t("AboutSettingsPage.about.title"),
      items: [
        <TitleFullWithLogo key={0} />,
        {
          title: t("AboutSettingsPage.about.settings.version.title"),
          children: config.basicInfo.launcherVersion,
        },
        {
          title: t("AboutSettingsPage.about.settings.contributors.title"),
          children: (
            <HStack spacing={0.5}>
              <AvatarGroup size="xs" spacing={-2}>
                {CoreContributorsList.slice(0, 3).map((item) => (
                  <Avatar
                    key={item.username}
                    name={item.username}
                    src={`https://avatars.githubusercontent.com/${item.username}`}
                  />
                ))}
              </AvatarGroup>
              <LinkIconButton
                url="/settings/contributors"
                aria-label="contributors"
              />
            </HStack>
          ),
        },
        {
          title: t("AboutSettingsPage.about.settings.reportIssue.title"),
          children: (
            <LinkIconButton
              url="https://github.com/UNIkeEN/SJMCL/issues"
              aria-label="issue"
              isExternal
              withTooltip
              h={18}
            />
          ),
        },
        {
          title: t("AboutSettingsPage.about.settings.aboutSJMC.title"),
          children: (
            <LinkIconButton
              url="https://mc.sjtu.cn/welcome/content/3/"
              aria-label="aboutSJMC"
              isExternal
              withTooltip
              h={18}
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
            <LinkIconButton
              url="https://github.com/bs-community/skinview3d"
              aria-label="skinview3d"
              isExternal
              withTooltip
            />
          ),
        },
        {
          title: t("AboutSettingsPage.ack.settings.bmclapi.title"),
          description: t("AboutSettingsPage.ack.settings.bmclapi.description"),
          children: (
            <LinkIconButton
              url="https://bmclapidoc.bangbang93.com/"
              aria-label="bmclapi"
              isExternal
              withTooltip
            />
          ),
        },
        {
          title: t("AboutSettingsPage.ack.settings.hmcl.title"),
          description: t("AboutSettingsPage.ack.settings.hmcl.description"),
          children: (
            <LinkIconButton
              url="https://hmcl.huangyuhui.net/"
              aria-label="hmcl"
              isExternal
              withTooltip
            />
          ),
        },
        {
          title: t("AboutSettingsPage.ack.settings.littleskin.title"),
          description: t(
            "AboutSettingsPage.ack.settings.littleskin.description"
          ),
          children: (
            <LinkIconButton
              url="https://github.com/LittleSkinChina"
              aria-label="littleskin"
              isExternal
              withTooltip
            />
          ),
        },
        {
          title: t("AboutSettingsPage.ack.settings.sinter.title"),
          description: t("AboutSettingsPage.ack.settings.sinter.description"),
          children: (
            <LinkIconButton
              url="https://m.ui.cn/details/615564"
              aria-label="sinter"
              isExternal
              withTooltip
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
            <LinkIconButton
              url="https://mc.sjtu.cn/sjmcl-tos/"
              aria-label="userAgreement"
              isExternal
              withTooltip
              h={18}
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
            <LinkIconButton
              url="https://github.com/UNIkeEN/SJMCL?tab=readme-ov-file#copyright"
              aria-label="openSourceLicense"
              isExternal
              withTooltip
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

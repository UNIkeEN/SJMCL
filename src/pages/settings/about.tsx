import { Avatar, AvatarGroup, HStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import LinkIconButton from "@/components/common/link-icon-button";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { TitleFull } from "@/components/logo-title";
import { useLauncherConfig } from "@/contexts/config";
import { CoreContributorsList } from "./contributors";

const AboutSettingsPage = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();

  const aboutSettingGroups: OptionItemGroupProps[] = [
    {
      title: t("AboutSettingsPage.about.title"),
      items: [
        <TitleFull my={1} key={0} />,
        {
          title: t("AboutSettingsPage.about.settings.version.title"),
          children: config.version,
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
              showTooltip
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
              showTooltip
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
          title: t("AboutSettingsPage.ack.settings.bmclapi.title"),
          description: t("AboutSettingsPage.ack.settings.bmclapi.description"),
          children: (
            <LinkIconButton
              url="https://bmclapidoc.bangbang93.com/"
              aria-label="bmclapi"
              isExternal
              showTooltip
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
              url="about:blank"
              aria-label="userAgreement"
              isExternal
              showTooltip
              h={18}
              isDisabled
            />
          ), // TBD
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
              url="https://github.com/UNIkeEN/SJMCL?tab=GPL-3.0-1-ov-file#readme"
              aria-label="openSourceLicense"
              isExternal
              showTooltip
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

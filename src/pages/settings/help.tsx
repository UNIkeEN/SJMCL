import { useTranslation } from 'react-i18next';
import { OptionItemGroupProps, OptionItemGroup } from "@/components/common/option-item";
import LinkIconButton from "@/components/common/link-icon-button";

const HelpSettingsPage = () => {
  const { t,i18n } = useTranslation();
  const helpSettingGroups: OptionItemGroupProps[] = [
    {
      title: t("HelpSettingsPage.help.title"),
      items: [
        {
          title: t("HelpSettingsPage.help.settings.LauncherGuide.title"),
          children: <LinkIconButton url="https://mc.sjtu.cn/launcher-faq" aria-label="launcherguide" isExternal h={18}/>
        }
      ]
    },
    {
      title: t("HelpSettingsPage.archive.title"),
      items: [
        {
          title: t("HelpSettingsPage.archive.settings.MinecraftWiki.title"),
          description: t("HelpSettingsPage.archive.settings.MinecraftWiki.description"),
          children: <LinkIconButton url={i18n.language === 'en'
              ? 'https://minecraft.wiki/'
              : 'https://zh.minecraft.wiki/'} aria-label="minecraftwiki" isExternal h={18}/>
        },
        {
          title: t("HelpSettingsPage.archive.settings.MinecraftMod.title"),
          description: t("HelpSettingsPage.archive.settings.MinecraftMod.description"),
          children: <LinkIconButton url="https://www.mcmod.cn/" aria-label="minecraftmod" isExternal h={18}/>
        },
        {
          title: t("HelpSettingsPage.archive.settings.curseforge.title"),
          description: t("HelpSettingsPage.archive.settings.curseforge.description"),
          children: <LinkIconButton url="https://www.curseforge.com/minecraft" aria-label="curseforge" isExternal h={18}/>
        },
      ]
    },
    {
      title: t("HelpSettingsPage.community.title"),
      items: [
        {
          title: t("HelpSettingsPage.community.settings.mua.title"),
          description: t("HelpSettingsPage.community.settings.mua.description"),
          children: <LinkIconButton url="https://www.mualliance.cn/" aria-label="mua" isExternal h={18}/>
        },
        {
          title: t("HelpSettingsPage.community.settings.SJMC.title"),
          children: <LinkIconButton url="https://mc.sjtu.cn/" aria-label="SJMC" isExternal h={18}/>
        },
      ]
    }
  ];

  return (
    <>
      {helpSettingGroups.map((group, index) => (
        <OptionItemGroup title={group.title} items={group.items} key={index} />
      ))}
    </>
  );
}

export default HelpSettingsPage;
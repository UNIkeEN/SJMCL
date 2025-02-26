import { Input, Switch, VStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";

interface GameAdvancedSettingsGroupsProps {
  instanceId?: number;
}

const GameAdvancedSettingsGroups: React.FC<GameAdvancedSettingsGroupsProps> = ({
  instanceId = 0,
}) => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const appearanceConfigs = config.appearance;
  const primaryColor = appearanceConfigs.theme.primaryColor;
  const updateGameAdvancedConfig = (key: string, value: any) => {
    if (instanceId) return; // TBD
    update(`gameAdvancedConfig.${key}`, value);
  };
  const settingGroups: OptionItemGroupProps[] = [
    {
      title: t("GameAdvanceSettingsPage.customCommands.title"),
      items: [
        {
          title: t(
            "GameAdvanceSettingsPage.customCommands.settings.gameArgument.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={380}
              focusBorderColor={`${primaryColor}.500`}
              placeholder={t(
                "GameAdvanceSettingsPage.customCommands.settings.gameArgument.placeholder"
              )}
            />
          ),
        },
        {
          title: t(
            "GameAdvanceSettingsPage.customCommands.settings.prelaunchCommand.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={380}
              focusBorderColor={`${primaryColor}.500`}
              placeholder={t(
                "GameAdvanceSettingsPage.customCommands.settings.prelaunchCommand.placeholder"
              )}
            />
          ),
        },
        {
          title: t(
            "GameAdvanceSettingsPage.customCommands.settings.wrapperCommands.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={380}
              focusBorderColor={`${primaryColor}.500`}
              placeholder={t(
                "GameAdvanceSettingsPage.customCommands.settings.wrapperCommands.placeholder"
              )}
            />
          ),
        },
        {
          title: t(
            "GameAdvanceSettingsPage.customCommands.settings.postexitCommand.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={380}
              focusBorderColor={`${primaryColor}.500`}
              placeholder={t(
                "GameAdvanceSettingsPage.customCommands.settings.postexitCommand.placeholder"
              )}
            />
          ),
        },
      ],
    },
    {
      title: t("GameAdvanceSettingsPage.javaVMOptions.title"),
      items: [
        {
          title: t(
            "GameAdvanceSettingsPage.javaVMOptions.settings.argument.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={380}
              focusBorderColor={`${primaryColor}.500`}
            />
          ),
        },
        {
          title: t(
            "GameAdvanceSettingsPage.javaVMOptions.settings.permGenSpace.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={380}
              focusBorderColor={`${primaryColor}.500`}
              placeholder={t(
                "GameAdvanceSettingsPage.javaVMOptions.settings.permGenSpace.placeholder"
              )}
            />
          ),
        },
        {
          title: t(
            "GameAdvanceSettingsPage.javaVMOptions.settings.environmentVariable.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={380}
              focusBorderColor={`${primaryColor}.500`}
            />
          ),
        },
      ],
    },
    {
      title: t("GameAdvanceSettingsPage.workaround.title"),
      items: [
        {
          title: t("GameAdvanceSettingsPage.workaround.settings.notAddJVM"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={appearanceConfigs.accessibility.invertColors}
              onChange={() => {}}
            />
          ),
        },
        {
          title: t(
            "GameAdvanceSettingsPage.workaround.settings.notCheckGameIntergrity.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={appearanceConfigs.accessibility.invertColors}
              onChange={() => {}}
            />
          ),
        },
        {
          title: t(
            "GameAdvanceSettingsPage.workaround.settings.notCheckJVMCompatibility.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={appearanceConfigs.accessibility.invertColors}
              onChange={() => {}}
            />
          ),
        },
        {
          title: t(
            "GameAdvanceSettingsPage.workaround.settings.notAutomaticallyReplaceNativeLibrary.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={appearanceConfigs.accessibility.invertColors}
              onChange={() => {}}
            />
          ),
        },
        {
          title: t(
            "GameAdvanceSettingsPage.workaround.settings.useSystemGLFW.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={appearanceConfigs.accessibility.invertColors}
              onChange={() => {}}
            />
          ),
        },
        {
          title: t(
            "GameAdvanceSettingsPage.workaround.settings.useSystemOpenAL.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={appearanceConfigs.accessibility.invertColors}
              onChange={() => {}}
            />
          ),
        },
      ],
    },
  ];

  return (
    <VStack overflow="auto" align="strench" spacing={4} flex="1">
      {settingGroups.map((group, index) => (
        <OptionItemGroup title={group.title} items={group.items} key={index} />
      ))}
    </VStack>
  );
};

export default GameAdvancedSettingsGroups;

import { Input, Switch, VStack } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { defaultGameAdvancedConfig } from "@/models/config";

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
  const gameAdvancedConfigs = instanceId
    ? defaultGameAdvancedConfig // TBD
    : config.gameAdvancedConfig;

  const [gameArgument, setGameArgument] = useState<string>(
    gameAdvancedConfigs.customCommands.gameArgument
  );
  const [prelaunchCommand, setPrelaunchCommand] = useState<string>(
    gameAdvancedConfigs.customCommands.prelaunchCommand
  );
  const [wrapperCommands, setWrapperCommands] = useState<string>(
    gameAdvancedConfigs.customCommands.wrapperCommands
  );
  const [postexitCommand, setPostexitCommand] = useState<string>(
    gameAdvancedConfigs.customCommands.postexitCommand
  );
  const [argument, setArgument] = useState<string>(
    gameAdvancedConfigs.javaVMOptions.argument
  );
  const [permGenSpace, setPermGenSpace] = useState<string>(
    gameAdvancedConfigs.javaVMOptions.permGenSpace
  );
  const [environmentVariable, setEnvironmentVariable] = useState<string>(
    gameAdvancedConfigs.javaVMOptions.environmentVariable
  );

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
              value={gameArgument}
              onChange={(event) => setGameArgument(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig(
                  "customCommands.gameArgument",
                  gameArgument
                );
              }}
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
              value={prelaunchCommand}
              onChange={(event) => setPrelaunchCommand(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig(
                  "customCommands.prelaunchCommand",
                  prelaunchCommand
                );
              }}
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
              value={wrapperCommands}
              onChange={(event) => setWrapperCommands(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig(
                  "customCommands.wrapperCommands",
                  wrapperCommands
                );
              }}
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
              value={postexitCommand}
              onChange={(event) => setPostexitCommand(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig(
                  "customCommands.postexitCommand",
                  postexitCommand
                );
              }}
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
              value={argument}
              onChange={(event) => setArgument(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig("javaVMOptions.argument", argument);
              }}
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
              value={permGenSpace}
              onChange={(event) => setPermGenSpace(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig(
                  "javaVMOptions.permGenSpace",
                  permGenSpace
                );
              }}
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
              value={environmentVariable}
              onChange={(event) => setEnvironmentVariable(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig(
                  "javaVMOptions.environmentVariable",
                  environmentVariable
                );
              }}
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
              isChecked={gameAdvancedConfigs.workaround.notAddJVM}
              onChange={(event) => {
                updateGameAdvancedConfig(
                  "workaround.notAddJVM",
                  event.target.checked
                );
              }}
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
              isChecked={gameAdvancedConfigs.workaround.notCheckGameIntergrity}
              onChange={(event) => {
                updateGameAdvancedConfig(
                  "workaround.notCheckGameIntergrity",
                  event.target.checked
                );
              }}
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
              isChecked={
                gameAdvancedConfigs.workaround.notCheckJVMCompatibility
              }
              onChange={(event) => {
                updateGameAdvancedConfig(
                  "workaround.notCheckJVMCompatibility",
                  event.target.checked
                );
              }}
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
              isChecked={
                gameAdvancedConfigs.workaround
                  .notAutomaticallyReplaceNativeLibrary
              }
              onChange={(event) => {
                updateGameAdvancedConfig(
                  "workaround.notAutomaticallyReplaceNativeLibrary",
                  event.target.checked
                );
              }}
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
              isChecked={gameAdvancedConfigs.workaround.useSystemGLFW}
              onChange={(event) => {
                updateGameAdvancedConfig(
                  "workaround.useSystemGLFW",
                  event.target.checked
                );
              }}
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
              isChecked={gameAdvancedConfigs.workaround.useSystemOpenAL}
              onChange={(event) => {
                updateGameAdvancedConfig(
                  "workaround.useSystemOpenAL",
                  event.target.checked
                );
              }}
            />
          ),
        },
      ],
    },
  ];

  return (
    <VStack overflow="auto" align="stretch" spacing={4} flex="1">
      {settingGroups.map((group, index) => (
        <OptionItemGroup title={group.title} items={group.items} key={index} />
      ))}
    </VStack>
  );
};

export default GameAdvancedSettingsGroups;

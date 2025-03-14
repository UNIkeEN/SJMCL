import {
  Button,
  Input,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Switch,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown } from "react-icons/lu";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { defaultGameConfig } from "@/models/config";

interface GameAdvancedSettingsGroupsProps {
  instanceId?: number;
}

const GameAdvancedSettingsGroups: React.FC<GameAdvancedSettingsGroupsProps> = ({
  instanceId,
}) => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const appearanceConfigs = config.appearance;
  const primaryColor = appearanceConfigs.theme.primaryColor;
  const gameAdvancedConfigs =
    instanceId !== undefined
      ? defaultGameConfig // TBD
      : config.globalGameConfig;

  const [minecraftArgument, setMinecraftArgument] = useState<string>(
    gameAdvancedConfigs.advanced.customCommands.minecraftArgument
  );
  const [precallCommand, setPrecallCommand] = useState<string>(
    gameAdvancedConfigs.advanced.customCommands.precallCommand
  );
  const [wrapperLauncher, setWrapperLauncher] = useState<string>(
    gameAdvancedConfigs.advanced.customCommands.wrapperLauncher
  );
  const [postExitCommand, setPostExitCommand] = useState<string>(
    gameAdvancedConfigs.advanced.customCommands.postExitCommand
  );
  const [args, setArgs] = useState<string>(
    gameAdvancedConfigs.advanced.jvm.args
  );
  const [javaPermanentGenerationSpace, setJavaPermanentGenerationSpace] =
    useState<string>(
      gameAdvancedConfigs.advanced.jvm.javaPermanentGenerationSpace
    );
  const [environmentVariable, setEnvironmentVariable] = useState<string>(
    gameAdvancedConfigs.advanced.jvm.environmentVariable
  );

  const gameCompletnessCheckPolicy = ["disable", "normal", "full"];
  const updateGameAdvancedConfig = (key: string, value: any) => {
    if (instanceId !== undefined) return; // TBD
    update(`globalGameConfig.advanced.${key}`, value);
  };

  const settingGroups: OptionItemGroupProps[] = [
    {
      title: t("GameAdvancedSettingsPage.customCommands.title"),
      items: [
        {
          title: t(
            "GameAdvancedSettingsPage.customCommands.settings.minecraftArgument.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={380}
              value={minecraftArgument}
              onChange={(event) => setMinecraftArgument(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig(
                  "customCommands.minecraftArgument",
                  minecraftArgument
                );
              }}
              focusBorderColor={`${primaryColor}.500`}
              placeholder={t(
                "GameAdvancedSettingsPage.customCommands.settings.minecraftArgument.placeholder"
              )}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.customCommands.settings.precallCommand.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={380}
              value={precallCommand}
              onChange={(event) => setPrecallCommand(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig(
                  "customCommands.precallCommand",
                  precallCommand
                );
              }}
              focusBorderColor={`${primaryColor}.500`}
              placeholder={t(
                "GameAdvancedSettingsPage.customCommands.settings.precallCommand.placeholder"
              )}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.customCommands.settings.wrapperLauncher.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={380}
              value={wrapperLauncher}
              onChange={(event) => setWrapperLauncher(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig(
                  "customCommands.wrapperLauncher",
                  wrapperLauncher
                );
              }}
              focusBorderColor={`${primaryColor}.500`}
              placeholder={t(
                "GameAdvancedSettingsPage.customCommands.settings.wrapperLauncher.placeholder"
              )}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.customCommands.settings.postExitCommand.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={380}
              value={postExitCommand}
              onChange={(event) => setPostExitCommand(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig(
                  "customCommands.postExitCommand",
                  postExitCommand
                );
              }}
              focusBorderColor={`${primaryColor}.500`}
              placeholder={t(
                "GameAdvancedSettingsPage.customCommands.settings.postExitCommand.placeholder"
              )}
            />
          ),
        },
      ],
    },
    {
      title: t("GameAdvancedSettingsPage.jvm.title"),
      items: [
        {
          title: t("GameAdvancedSettingsPage.jvm.settings.args.title"),
          children: (
            <Input
              size="xs"
              maxW={380}
              value={args}
              onChange={(event) => setArgs(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig("jvm.args", args);
              }}
              focusBorderColor={`${primaryColor}.500`}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.jvm.settings.javaPermanentGenerationSpace.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={380}
              value={javaPermanentGenerationSpace}
              onChange={(event) =>
                setJavaPermanentGenerationSpace(event.target.value)
              }
              onBlur={() => {
                updateGameAdvancedConfig(
                  "jvm.javaPermanentGenerationSpace",
                  javaPermanentGenerationSpace
                );
              }}
              focusBorderColor={`${primaryColor}.500`}
              placeholder={t(
                "GameAdvancedSettingsPage.jvm.settings.javaPermanentGenerationSpace.placeholder"
              )}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.jvm.settings.environmentVariable.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={380}
              value={environmentVariable}
              onChange={(event) => setEnvironmentVariable(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig(
                  "jvm.environmentVariable",
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
      title: t("GameAdvancedSettingsPage.workaround.title"),
      items: [
        {
          title: t(
            "GameAdvancedSettingsPage.workaround.settings.gameCompletnessCheckPolicy.title"
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
                  `GameAdvancedSettingsPage.workaround.settings.gameCompletnessCheckPolicy.${gameAdvancedConfigs.advanced.workaround.gameCompletnessCheckPolicy}`
                )}
              </MenuButton>
              <MenuList>
                <MenuOptionGroup
                  type="radio"
                  value={
                    gameAdvancedConfigs.advanced.workaround
                      .gameCompletnessCheckPolicy
                  }
                  onChange={(value) => {
                    updateGameAdvancedConfig(
                      "workaround.gameCompletnessCheckPolicy",
                      value
                    );
                  }}
                >
                  {gameCompletnessCheckPolicy.map((type) => (
                    <MenuItemOption value={type} fontSize="xs" key={type}>
                      {t(
                        `GameAdvancedSettingsPage.workaround.settings.gameCompletnessCheckPolicy.${type}`
                      )}
                    </MenuItemOption>
                  ))}
                </MenuOptionGroup>
              </MenuList>
            </Menu>
          ),
        },
        {
          title: t("GameAdvancedSettingsPage.workaround.settings.noJvmArgs"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={gameAdvancedConfigs.advanced.workaround.noJvmArgs}
              onChange={(event) => {
                updateGameAdvancedConfig(
                  "workaround.noJvmArgs",
                  event.target.checked
                );
              }}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.workaround.settings.dontCheckJvmValidity.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={
                gameAdvancedConfigs.advanced.workaround.dontCheckJvmValidity
              }
              onChange={(event) => {
                updateGameAdvancedConfig(
                  "workaround.dontCheckJvmValidity",
                  event.target.checked
                );
              }}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.workaround.settings.dontPatchNatives.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={
                gameAdvancedConfigs.advanced.workaround.dontPatchNatives
              }
              onChange={(event) => {
                updateGameAdvancedConfig(
                  "workaround.dontPatchNatives",
                  event.target.checked
                );
              }}
            />
          ),
        },
        ...(config.basicInfo.platform === "linux"
          ? [
              {
                title: t(
                  "GameAdvancedSettingsPage.workaround.settings.useNativeGlfw.title"
                ),
                children: (
                  <Switch
                    colorScheme={primaryColor}
                    isChecked={
                      gameAdvancedConfigs.advanced.workaround.useNativeGlfw
                    }
                    onChange={(event) => {
                      updateGameAdvancedConfig(
                        "workaround.useNativeGlfw",
                        event.target.checked
                      );
                    }}
                  />
                ),
              },
              {
                title: t(
                  "GameAdvancedSettingsPage.workaround.settings.useNativeOpenal.title"
                ),
                children: (
                  <Switch
                    colorScheme={primaryColor}
                    isChecked={
                      gameAdvancedConfigs.advanced.workaround.useNativeOpenal
                    }
                    onChange={(event) => {
                      updateGameAdvancedConfig(
                        "workaround.useNativeOpenal",
                        event.target.checked
                      );
                    }}
                  />
                ),
              },
            ]
          : []),
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

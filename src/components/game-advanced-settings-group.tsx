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
import { platform } from "@tauri-apps/plugin-os";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown } from "react-icons/lu";
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
  const [platformName, setPlatformName] = useState<string>("");
  useEffect(() => {
    const fetchPlatform = async () => {
      const name = await platform();
      setPlatformName(name);
    };
    fetchPlatform();
  }, []);
  const gameIntergrityCheckPolicy = [
    "not-check",
    "common-check",
    "strengthen-check",
  ];
  const updateGameAdvancedConfig = (key: string, value: any) => {
    if (instanceId) return; // TBD
    update(`gameAdvancedConfig.${key}`, value);
  };

  const settingGroups: OptionItemGroupProps[] = [
    {
      title: t("GameAdvancedSettingsPage.customCommands.title"),
      items: [
        {
          title: t(
            "GameAdvancedSettingsPage.customCommands.settings.gameArgument.title"
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
                "GameAdvancedSettingsPage.customCommands.settings.gameArgument.placeholder"
              )}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.customCommands.settings.prelaunchCommand.title"
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
                "GameAdvancedSettingsPage.customCommands.settings.prelaunchCommand.placeholder"
              )}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.customCommands.settings.wrapperCommands.title"
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
                "GameAdvancedSettingsPage.customCommands.settings.wrapperCommands.placeholder"
              )}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.customCommands.settings.postexitCommand.title"
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
                "GameAdvancedSettingsPage.customCommands.settings.postexitCommand.placeholder"
              )}
            />
          ),
        },
      ],
    },
    {
      title: t("GameAdvancedSettingsPage.javaVMOptions.title"),
      items: [
        {
          title: t(
            "GameAdvancedSettingsPage.javaVMOptions.settings.argument.title"
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
            "GameAdvancedSettingsPage.javaVMOptions.settings.permGenSpace.title"
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
                "GameAdvancedSettingsPage.javaVMOptions.settings.permGenSpace.placeholder"
              )}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.javaVMOptions.settings.environmentVariable.title"
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
      title: t("GameAdvancedSettingsPage.workaround.title"),
      items: [
        {
          title: t(
            "GameAdvancedSettingsPage.workaround.settings.gameIntergrityCheckPolicy.title"
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
                  `GameAdvancedSettingsPage.workaround.settings.gameIntergrityCheckPolicy.${gameAdvancedConfigs.workaround.gameIntergrityCheckPolicy}`
                )}
              </MenuButton>
              <MenuList>
                <MenuOptionGroup
                  type="radio"
                  value={
                    gameAdvancedConfigs.workaround.gameIntergrityCheckPolicy
                  }
                  onChange={(value) => {
                    updateGameAdvancedConfig(
                      "workaround.gameIntergrityCheckPolicy",
                      value
                    );
                  }}
                >
                  {gameIntergrityCheckPolicy.map((type) => (
                    <MenuItemOption value={type} fontSize="xs" key={type}>
                      {t(
                        `GameAdvancedSettingsPage.workaround.settings.gameIntergrityCheckPolicy.${type}`
                      )}
                    </MenuItemOption>
                  ))}
                </MenuOptionGroup>
              </MenuList>
            </Menu>
          ),
        },
        {
          title: t("GameAdvancedSettingsPage.workaround.settings.notAddJVM"),
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
            "GameAdvancedSettingsPage.workaround.settings.notCheckJVMCompatibility.title"
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
            "GameAdvancedSettingsPage.workaround.settings.notAutomaticallyReplaceNativeLibrary.title"
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
        ...(platformName === "linux"
          ? [
              {
                title: t(
                  "GameAdvancedSettingsPage.workaround.settings.useSystemGLFW.title"
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
                  "GameAdvancedSettingsPage.workaround.settings.useSystemOpenAL.title"
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

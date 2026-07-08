import {
  Alert,
  AlertIcon,
  Button,
  HStack,
  Input,
  Link,
  NumberInput,
  NumberInputField,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { MenuSelector } from "@/components/common/menu-selector";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useProxySettingsItems } from "@/components/common/proxy-settings-group";
import { Section } from "@/components/common/section";
import { GameSettingsGroupsProps } from "@/components/game-settings-groups";
import { useLauncherConfig } from "@/contexts/config";
import { ConfigService } from "@/services/config";

const GameAdvancedSettingsGroups: React.FC<GameSettingsGroupsProps> = ({
  gameConfig,
  updateGameConfig,
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const appearanceConfigs = config.appearance;
  const primaryColor = appearanceConfigs.theme.primaryColor;

  const [minecraftArgument, setMinecraftArgument] = useState<string>(
    gameConfig.advanced.customCommands.minecraftArgument
  );
  const [precallCommand, setPrecallCommand] = useState<string>(
    gameConfig.advanced.customCommands.precallCommand
  );
  const [wrapperLauncher, setWrapperLauncher] = useState<string>(
    gameConfig.advanced.customCommands.wrapperLauncher
  );
  const [postExitCommand, setPostExitCommand] = useState<string>(
    gameConfig.advanced.customCommands.postExitCommand
  );
  const [args, setArgs] = useState<string>(gameConfig.advanced.jvm.args);
  const [javaPermanentGenerationSpace, setJavaPermanentGenerationSpace] =
    useState<number>(gameConfig.advanced.jvm.javaPermanentGenerationSpace);
  const [environmentVariable, setEnvironmentVariable] = useState<string>(
    gameConfig.advanced.jvm.environmentVariable
  );

  const garbageCollectors = [
    "auto",
    "g1gc",
    "zgc",
    "shenandoah",
    "parallel",
    "serial",
  ];

  const graphicsApis = ["default", "opengl", "vulkan"];
  const [supportedRenderers, setSupportedRenderers] = useState<string[] | null>(
    null
  );
  const rendererOptions = supportedRenderers ?? ["default"];

  const gameFileValidatePolicies = ["disable", "normal", "full"];
  const updateGameAdvancedConfig = useCallback(
    (key: string, value: any) => {
      updateGameConfig(`advanced.${key}`, value);
    },
    [updateGameConfig]
  );

  useEffect(() => {
    const fetchRenderers = async () => {
      const res = await ConfigService.retrieveSupportedGraphicsRenderers(
        gameConfig.advanced.graphics.api
      );
      const renderers =
        res.status === "success" && res.data.length > 0
          ? res.data
          : ["default"];
      setSupportedRenderers(renderers);
      if (!renderers.includes(gameConfig.advanced.graphics.renderer)) {
        updateGameAdvancedConfig("graphics.renderer", "default");
      }
    };
    fetchRenderers();
  }, [gameConfig.advanced.graphics, updateGameAdvancedConfig]);

  const handleSelectAuthlibJar = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "JAR", extensions: ["jar"] }],
      defaultPath:
        gameConfig.advanced.workaround.useCustomAuthlibInjector.path ||
        undefined,
    });
    if (selected && typeof selected === "string") {
      updateGameAdvancedConfig(
        "workaround.useCustomAuthlibInjector.path",
        selected
      );
    }
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
              maxW={370}
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
              maxW={370}
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
              maxW={370}
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
              maxW={370}
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
          title: t(
            "GameAdvancedSettingsPage.jvm.settings.garbageCollector.title"
          ),
          description: t(
            "GameAdvancedSettingsPage.jvm.settings.garbageCollector.desc"
          ),
          children: (
            <MenuSelector
              options={garbageCollectors.map((value) => ({
                value,
                label: t(
                  `GameAdvancedSettingsPage.jvm.settings.garbageCollector.options.${value}`
                ),
              }))}
              value={gameConfig.advanced.jvm.garbageCollector}
              onSelect={(val) => {
                updateGameAdvancedConfig("jvm.garbageCollector", val);
              }}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.jvm.settings.javaPermanentGenerationSpace.title"
          ),
          children: (
            <NumberInput
              size="xs"
              w={370}
              value={javaPermanentGenerationSpace}
              onChange={(value) => {
                if (!/^\d*$/.test(value)) return;
                setJavaPermanentGenerationSpace(Number(value));
              }}
              onBlur={() => {
                updateGameAdvancedConfig(
                  "jvm.javaPermanentGenerationSpace",
                  Math.min(javaPermanentGenerationSpace, 2 ** 32 - 1)
                );
              }}
              focusBorderColor={`${primaryColor}.500`}
            >
              <NumberInputField pr={0} />
            </NumberInput>
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.jvm.settings.environmentVariable.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={370}
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
        {
          title: t("GameAdvancedSettingsPage.jvm.settings.args.title"),
          children: (
            <Input
              size="xs"
              maxW={370}
              value={args}
              onChange={(event) => setArgs(event.target.value)}
              onBlur={() => {
                updateGameAdvancedConfig("jvm.args", args);
              }}
              focusBorderColor={`${primaryColor}.500`}
            />
          ),
        },
      ],
    },
    {
      title: t("GameAdvancedSettingsPage.graphics.title"),
      items: [
        {
          title: t("GameAdvancedSettingsPage.graphics.settings.api.title"),
          children: (
            <MenuSelector
              options={graphicsApis.map((value) => ({
                value,
                label: {
                  title: t(
                    `GameAdvancedSettingsPage.graphics.settings.api.${value}.label`
                  ),
                  desc: t(
                    `GameAdvancedSettingsPage.graphics.settings.api.${value}.desc`
                  ),
                },
              }))}
              value={gameConfig.advanced.graphics.api}
              onSelect={(val) => {
                updateGameAdvancedConfig("graphics.api", val);
                updateGameAdvancedConfig("graphics.renderer", "default");
              }}
            />
          ),
        },
        ...(gameConfig.advanced.graphics.api !== "default"
          ? [
              {
                title: t(
                  "GameAdvancedSettingsPage.graphics.settings.renderer.title"
                ),
                children: (
                  <MenuSelector
                    options={rendererOptions.map((value) => ({
                      value,
                      label: t(
                        `GameAdvancedSettingsPage.graphics.settings.renderer.${value}`
                      ),
                    }))}
                    value={
                      rendererOptions.includes(
                        gameConfig.advanced.graphics.renderer
                      )
                        ? gameConfig.advanced.graphics.renderer
                        : "default"
                    }
                    onSelect={(val) => {
                      updateGameAdvancedConfig("graphics.renderer", val);
                    }}
                    menuListProps={{ maxH: 72, overflowY: "auto" }}
                  />
                ),
              },
            ]
          : []),
      ],
    },
    {
      title: t("GameAdvancedSettingsPage.proxy.title"),
      items: useProxySettingsItems(
        "GameAdvancedSettingsPage.proxy",
        gameConfig.advanced.proxy,
        (key, value) => updateGameAdvancedConfig(`proxy.${key}`, value)
      ),
    },
    {
      title: t("GameAdvancedSettingsPage.workaround.title"),
      items: [
        {
          title: t(
            "GameAdvancedSettingsPage.workaround.settings.gameFileValidatePolicy.title"
          ),
          children: (
            <HStack>
              <MenuSelector
                options={gameFileValidatePolicies.map((type) => ({
                  value: type,
                  label: {
                    title: t(
                      `GameAdvancedSettingsPage.workaround.settings.gameFileValidatePolicy.${type}`
                    ),
                    desc: t(
                      `GameAdvancedSettingsPage.workaround.settings.gameFileValidatePolicy.${type}Desc`
                    ),
                  },
                }))}
                value={gameConfig.advanced.workaround.gameFileValidatePolicy}
                onSelect={(val) => {
                  updateGameAdvancedConfig(
                    "workaround.gameFileValidatePolicy",
                    val
                  );
                }}
              />
            </HStack>
          ),
        },
        {
          title: t("GameAdvancedSettingsPage.workaround.settings.noJvmArgs"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={gameConfig.advanced.workaround.noJvmArgs}
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
              isChecked={gameConfig.advanced.workaround.dontCheckJvmValidity}
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
              isChecked={gameConfig.advanced.workaround.dontPatchNatives}
              onChange={(event) => {
                updateGameAdvancedConfig(
                  "workaround.dontPatchNatives",
                  event.target.checked
                );
              }}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.workaround.settings.useLwjglUnsafeAgent.title"
          ),
          description: (
            <Text fontSize="xs" className="secondary-text">
              <Trans
                i18nKey="GameAdvancedSettingsPage.workaround.settings.useLwjglUnsafeAgent.description"
                components={{
                  hmcl: (
                    <Link
                      color={`${primaryColor}.500`}
                      onClick={() => {
                        openUrl(
                          "https://github.com/HMCL-dev/lwjgl-unsafe-agent"
                        );
                      }}
                    />
                  ),
                }}
              />
            </Text>
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={gameConfig.advanced.workaround.useLwjglUnsafeAgent}
              onChange={(event) => {
                updateGameAdvancedConfig(
                  "workaround.useLwjglUnsafeAgent",
                  event.target.checked
                );
              }}
            />
          ),
        },
        {
          title: t(
            "GameAdvancedSettingsPage.workaround.settings.useCustomAuthlibInjector.title"
          ),
          description: gameConfig.advanced.workaround.useCustomAuthlibInjector
            .enabled
            ? gameConfig.advanced.workaround.useCustomAuthlibInjector.path ||
              t(
                "GameAdvancedSettingsPage.workaround.settings.useCustomAuthlibInjector.description.notSet"
              )
            : "",
          children: (
            <HStack>
              {gameConfig.advanced.workaround.useCustomAuthlibInjector
                .enabled && (
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={handleSelectAuthlibJar}
                >
                  {t(
                    "GameAdvancedSettingsPage.workaround.settings.useCustomAuthlibInjector.select"
                  )}
                </Button>
              )}
              <Switch
                colorScheme={primaryColor}
                isChecked={
                  gameConfig.advanced.workaround.useCustomAuthlibInjector
                    .enabled
                }
                onChange={(event) => {
                  updateGameAdvancedConfig(
                    "workaround.useCustomAuthlibInjector.enabled",
                    event.target.checked
                  );
                }}
              />
            </HStack>
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
                    isChecked={gameConfig.advanced.workaround.useNativeGlfw}
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
                    isChecked={gameConfig.advanced.workaround.useNativeOpenal}
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
    <Section
      // className="content-full-y"
      title={t("GameAdvancedSettingsPage.title")}
      withBackButton
    >
      <VStack align="stretch" spacing={4} flex="1">
        <Alert status="warning" fontSize="xs-sm" borderRadius="md">
          <AlertIcon />
          {t("GameAdvancedSettingsPage.topWarning")}
        </Alert>
        {settingGroups.map((group, index) => (
          <OptionItemGroup
            title={group.title}
            items={group.items}
            key={index}
          />
        ))}
      </VStack>
    </Section>
  );
};

export default GameAdvancedSettingsGroups;

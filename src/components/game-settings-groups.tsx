import {
  Button,
  HStack,
  Input,
  NumberInput,
  NumberInputField,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MenuSelector } from "@/components/common/menu-selector";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import MemoryStatusProgress from "@/components/memory-status-progress";
import { useLauncherConfig } from "@/contexts/config";
import { GameConfig } from "@/models/config";
import { MemoryInfo } from "@/models/system-info";
import { JavaInfo } from "@/models/system-info";
import { UtilsService } from "@/services/utils";

export interface GameSettingsGroupsProps {
  gameConfig: GameConfig;
  updateGameConfig: (key: string, value: any) => void;
}

const GameSettingsGroups: React.FC<GameSettingsGroupsProps> = ({
  gameConfig,
  updateGameConfig,
}) => {
  const { t } = useTranslation();
  const { config, getJavaInfos } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const router = useRouter();

  const [javaInfos, setJavaInfos] = useState<JavaInfo[]>([]);

  // use state and useEffect to track and render
  const [gameWindowWidth, setGameWindowWidth] = useState<number>(400);
  const [gameWindowHeight, setGameWindowHeight] = useState<number>(300);
  const [maxMemAllocation, setMaxMemAllocation] = useState<number>(0);
  const [sliderMaxMemAllocation, setSliderMaxMemAllocation] =
    useState<number>(0);
  const [customTitle, setCustomTitle] = useState<string>("");
  const [customInfo, setCustomInfo] = useState<string>("");
  const [serverUrl, setServerUrl] = useState<string>("");

  useEffect(() => {
    setGameWindowWidth(gameConfig.gameWindow.resolution.width);
    setGameWindowHeight(gameConfig.gameWindow.resolution.height);
    setMaxMemAllocation(gameConfig.performance.maxMemAllocation);
    setSliderMaxMemAllocation(gameConfig.performance.maxMemAllocation);
    setCustomTitle(gameConfig.gameWindow.customTitle);
    setCustomInfo(gameConfig.gameWindow.customInfo);
    setServerUrl(gameConfig.gameServer.serverUrl);
  }, [gameConfig]);

  const buildJavaMenuLabel = (java: JavaInfo | undefined) => {
    if (!java) return "";
    return `Java ${java.majorVersion}${java.isLts ? " (LTS)" : ""} (${java.execPath})`;
  };

  useEffect(() => {
    setJavaInfos(getJavaInfos() || []);
  }, [getJavaInfos]);

  const launcherVisibilityStrategy = ["startHidden", "runningHidden", "always"];
  const processPriority = [
    "low",
    "belowNormal",
    "normal",
    "aboveNormal",
    "high",
  ];

  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo>({
    total: 0,
    used: 0,
    suggestedMaxAlloc: 0,
  });
  const maxMemCanAllocated = Math.floor(memoryInfo.total / 1024 / 1024);

  const handleRetrieveMemoryInfo = async () => {
    const res = await UtilsService.retrieveMemoryInfo();
    if (res.status === "success") {
      setMemoryInfo(res.data);
    }
  };

  useEffect(() => {
    handleRetrieveMemoryInfo();
    const interval = setInterval(handleRetrieveMemoryInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  const settingGroups: OptionItemGroupProps[] = [
    {
      title: t("GlobalGameSettingsPage.gameJava.title"),
      items: [
        {
          title: t("GlobalGameSettingsPage.gameJava.settings.autoSelect.title"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={gameConfig.gameJava.auto}
              onChange={(event) => {
                updateGameConfig("gameJava.auto", event.target.checked);
              }}
            />
          ),
        },
        ...(gameConfig.gameJava.auto
          ? []
          : [
              {
                title: t(
                  "GlobalGameSettingsPage.gameJava.settings.execPath.title"
                ),
                children: (
                  <MenuSelector
                    value={gameConfig.gameJava.execPath}
                    onSelect={(val) =>
                      updateGameConfig("gameJava.execPath", val)
                    }
                    options={javaInfos.map((java) => ({
                      value: java.execPath,
                      label: buildJavaMenuLabel(java),
                    }))}
                    placeholder={""}
                  />
                ),
              },
            ]),
      ],
    },
    {
      title: t("GlobalGameSettingsPage.gameWindow.title"),
      items: [
        {
          title: t(
            "GlobalGameSettingsPage.gameWindow.settings.resolution.title"
          ),
          children: (
            <HStack>
              <NumberInput
                min={400}
                size="xs"
                maxW={16}
                focusBorderColor={`${primaryColor}.500`}
                value={gameWindowWidth}
                onChange={(value) => {
                  if (!/^\d*$/.test(value)) return;
                  setGameWindowWidth(Number(value));
                }}
                onBlur={() => {
                  updateGameConfig(
                    "gameWindow.resolution.width",
                    Math.max(400, Math.min(gameWindowWidth, 2 ** 32 - 1))
                  );
                }}
              >
                {/* no stepper NumberInput, use pr={0} */}
                <NumberInputField pr={0} />
              </NumberInput>
              <Text fontSize="sm" mt={-1}>
                ×
              </Text>
              <NumberInput
                min={300}
                size="xs"
                maxW={16}
                focusBorderColor={`${primaryColor}.500`}
                value={gameWindowHeight}
                onChange={(value) => {
                  if (!/^\d*$/.test(value)) return;
                  setGameWindowHeight(Number(value));
                }}
                onBlur={() => {
                  updateGameConfig(
                    "gameWindow.resolution.height",
                    Math.max(300, Math.min(gameWindowHeight, 2 ** 32 - 1))
                  );
                }}
              >
                <NumberInputField pr={0} />
              </NumberInput>
              <Switch
                colorScheme={primaryColor}
                isChecked={gameConfig.gameWindow.resolution.fullscreen}
                onChange={(event) => {
                  updateGameConfig(
                    "gameWindow.resolution.fullscreen",
                    event.target.checked
                  );
                }}
              />
              <Text fontSize="xs">
                {t(
                  "GlobalGameSettingsPage.gameWindow.settings.resolution.switch"
                )}
              </Text>
            </HStack>
          ),
        },
        {
          title: t(
            "GlobalGameSettingsPage.gameWindow.settings.customTitle.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={32}
              value={customTitle}
              onChange={(event) => {
                setCustomTitle(event.target.value);
              }}
              onBlur={() => {
                updateGameConfig("gameWindow.customTitle", customTitle);
              }}
              focusBorderColor={`${primaryColor}.500`}
            />
          ),
        },
        {
          title: t(
            "GlobalGameSettingsPage.gameWindow.settings.customInfo.title"
          ),
          description: t(
            "GlobalGameSettingsPage.gameWindow.settings.customInfo.description"
          ),
          children: (
            <Input
              size="xs"
              maxW={32}
              value={customInfo}
              onChange={(event) => {
                setCustomInfo(event.target.value);
              }}
              onBlur={() => {
                updateGameConfig("gameWindow.customInfo", customInfo);
              }}
              focusBorderColor={`${primaryColor}.500`}
            />
          ),
        },
      ],
    },
    {
      title: t("GlobalGameSettingsPage.performance.title"),
      items: [
        {
          title: t(
            "GlobalGameSettingsPage.performance.settings.autoMemAllocation.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={gameConfig.performance.autoMemAllocation}
              onChange={(event) => {
                updateGameConfig(
                  "performance.autoMemAllocation",
                  event.target.checked
                );
              }}
            />
          ),
        },
        ...(gameConfig.performance.autoMemAllocation
          ? []
          : [
              {
                title: t(
                  "GlobalGameSettingsPage.performance.settings.maxMemAllocation.title"
                ),
                children: (
                  <HStack spacing={2}>
                    <Slider
                      min={256}
                      max={maxMemCanAllocated || 8192}
                      step={16}
                      w={32}
                      colorScheme={primaryColor}
                      value={sliderMaxMemAllocation}
                      onChange={(value) => {
                        setSliderMaxMemAllocation(value);
                        setMaxMemAllocation(value);
                      }}
                      onBlur={() => {
                        updateGameConfig(
                          "performance.maxMemAllocation",
                          maxMemAllocation
                        );
                      }}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                    <NumberInput
                      min={256}
                      max={maxMemCanAllocated || 8192}
                      size="xs"
                      maxW={16}
                      focusBorderColor={`${primaryColor}.500`}
                      value={maxMemAllocation}
                      onChange={(value) => {
                        if (!/^\d*$/.test(value)) return;
                        setMaxMemAllocation(Number(value));
                      }}
                      onBlur={() => {
                        setSliderMaxMemAllocation(maxMemAllocation);
                        updateGameConfig(
                          "performance.maxMemAllocation",
                          Math.max(
                            256,
                            Math.min(
                              maxMemAllocation,
                              maxMemCanAllocated || 8192
                            )
                          )
                        );
                      }}
                    >
                      <NumberInputField pr={0} />
                    </NumberInput>
                    <Text fontSize="xs">MB</Text>
                  </HStack>
                ),
              },
            ]),
        <MemoryStatusProgress
          key="mem"
          memoryInfo={memoryInfo}
          allocatedMemory={
            gameConfig.performance.autoMemAllocation
              ? memoryInfo.suggestedMaxAlloc / 1024 / 1024
              : maxMemAllocation
          }
        />,
        {
          title: t(
            "GlobalGameSettingsPage.performance.settings.processPriority.title"
          ),
          children: (
            <MenuSelector
              value={gameConfig.performance.processPriority}
              onSelect={(val) =>
                updateGameConfig("performance.processPriority", val)
              }
              options={processPriority.map((type) => ({
                value: type,
                label: t(
                  `GlobalGameSettingsPage.performance.settings.processPriority.${type}`
                ),
              }))}
            />
          ),
        },
      ],
    },
    {
      title: t("GlobalGameSettingsPage.moreOptions.title"),
      items: [
        {
          title: t(
            "GlobalGameSettingsPage.moreOptions.settings.launcherVisibility.title"
          ),
          children: (
            <MenuSelector
              value={gameConfig.launcherVisibility}
              onSelect={(val) => updateGameConfig("launcherVisibility", val)}
              options={launcherVisibilityStrategy.map((type) => ({
                value: type,
                label: t(
                  `GlobalGameSettingsPage.moreOptions.settings.launcherVisibility.${type}`
                ),
              }))}
            />
          ),
        },
        {
          title: t(
            "GlobalGameSettingsPage.moreOptions.settings.autoJoinGameServer.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={gameConfig.gameServer.autoJoin}
              onChange={(event) => {
                updateGameConfig("gameServer.autoJoin", event.target.checked);
              }}
            />
          ),
        },
        ...(gameConfig.gameServer.autoJoin
          ? [
              {
                title: t(
                  "GlobalGameSettingsPage.moreOptions.settings.serverUrl.title"
                ),
                children: (
                  <Input
                    size="xs"
                    w={64}
                    value={serverUrl}
                    onChange={(event) => {
                      setServerUrl(event.target.value);
                    }}
                    onBlur={() => {
                      updateGameConfig("gameServer.serverUrl", serverUrl);
                    }}
                    focusBorderColor={`${primaryColor}.500`}
                  />
                ),
              },
            ]
          : []),
        {
          title: t(
            "GlobalGameSettingsPage.moreOptions.settings.displayGameLog.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={gameConfig.displayGameLog}
              onChange={(event) => {
                updateGameConfig("displayGameLog", event.target.checked);
              }}
            />
          ),
        },
        {
          title: t(
            "GlobalGameSettingsPage.moreOptions.settings.advancedOptions.title"
          ),
          children: (
            <Button
              size="xs"
              variant="subtle"
              justifyContent="flex-start"
              onClick={() => {
                router.push(`${router.asPath}/advanced`);
              }}
            >
              <Text>
                {t(
                  "GlobalGameSettingsPage.moreOptions.settings.advancedOptions.button"
                )}
              </Text>
            </Button>
          ),
        },
      ],
    },
  ];

  return (
    <>
      <VStack overflow="auto" align="stretch" spacing={4} flex="1">
        {settingGroups.map((group, index) => (
          <OptionItemGroup
            title={group.title}
            items={group.items}
            key={index}
          />
        ))}
      </VStack>
    </>
  );
};

export default GameSettingsGroups;

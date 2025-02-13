import {
  Button,
  HStack,
  Input,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
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
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown } from "react-icons/lu";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import MemoryStatusProgress from "@/components/memory-status-progress";
import { useLauncherConfig } from "@/contexts/config";
import { MemoryInfo } from "@/models/system-info";
import { retriveMemoryInfo } from "@/services/utils";

interface GameSettingsGroupsProps {
  instanceId?: number;
}

const GameSettingsGroups: React.FC<GameSettingsGroupsProps> = ({
  instanceId = 0,
}) => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const globalGameConfigs = config.globalGameConfig;

  const isolationStrategy = [
    "off",
    "full",
    "modable",
    "informal",
    "modable-and-informal",
  ];
  const launcherVisibilityStrategy = [
    "start-close",
    "running-hidden",
    "always",
  ];
  const processPriority = ["low", "middle", "high"];

  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo>({
    total: 0,
    used: 0,
  });
  const maxMemCanAllocated = Math.floor(memoryInfo.total / 1024 / 1024);

  const handleRetriveMemoryInfo = async () => {
    retriveMemoryInfo()
      .then((info) => {
        setMemoryInfo(info);
      })
      .catch((error) => {});
  };

  useEffect(() => {
    handleRetriveMemoryInfo();
    const interval = setInterval(handleRetriveMemoryInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  const settingGroups: OptionItemGroupProps[] = [
    {
      title: t("GlobalGameSettingsPage.gameWindow.title"),
      items: [
        {
          title: t(
            "GlobalGameSettingsPage.gameWindow.settings.gameWindowResolution.title"
          ),
          children: (
            <HStack>
              <NumberInput
                min={400}
                size="xs"
                maxW={16}
                focusBorderColor={`${primaryColor}.500`}
                value={globalGameConfigs.gameWindow.gameWindowResolution.width}
                onChange={(value) => {
                  if (instanceId) return; // TBD
                  update(
                    "globalGameConfig.gameWindow.gameWindowResolution.width",
                    Number(value)
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
                value={globalGameConfigs.gameWindow.gameWindowResolution.height}
                onChange={(value) => {
                  if (instanceId) return; // TBD
                  update(
                    "globalGameConfig.gameWindow.gameWindowResolution.height",
                    Number(value)
                  );
                }}
              >
                <NumberInputField pr={0} />
              </NumberInput>
              <Switch
                colorScheme={primaryColor}
                isChecked={
                  globalGameConfigs.gameWindow.gameWindowResolution.fullscreen
                }
                onChange={(event) => {
                  if (instanceId) return; // TBD
                  update(
                    "globalGameConfig.gameWindow.gameWindowResolution.fullscreen",
                    event.target.checked
                  );
                }}
              />
              <Text fontSize="xs">
                {t(
                  "GlobalGameSettingsPage.gameWindow.settings.gameWindowResolution.switch"
                )}
              </Text>
            </HStack>
          ),
        },
        {
          title: t(
            "GlobalGameSettingsPage.gameWindow.settings.gameWindowTitle.title"
          ),
          children: (
            <Input
              size="xs"
              maxW={32}
              value={globalGameConfigs.gameWindow.gameWindowTitle}
              onChange={(event) => {
                if (instanceId) return; // TBD
                update(
                  "globalGameConfig.gameWindow.gameWindowTitle",
                  event.target.value
                );
              }}
              focusBorderColor={`${primaryColor}.500`}
            />
          ),
        },
        {
          title: t(
            "GlobalGameSettingsPage.gameWindow.settings.gameWindowCustomInfo.title"
          ),
          description: t(
            "GlobalGameSettingsPage.gameWindow.settings.gameWindowCustomInfo.description"
          ),
          children: (
            <Input
              size="xs"
              maxW={32}
              value={globalGameConfigs.gameWindow.gameWindowCustomInfo}
              onChange={(event) => {
                if (instanceId) return; // TBD
                update(
                  "globalGameConfig.gameWindow.gameWindowCustomInfo",
                  event.target.value
                );
              }}
              alignSelf="center"
              margin="auto 0"
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
              isChecked={globalGameConfigs.performance.autoMemAllocation}
              onChange={(event) => {
                if (instanceId) return; // TBD
                update(
                  "globalGameConfig.performance.autoMemAllocation",
                  event.target.checked
                );
              }}
            />
          ),
        },
        ...(globalGameConfigs.performance.autoMemAllocation
          ? []
          : [
              {
                title: t(
                  "GlobalGameSettingsPage.performance.settings.minMemAllocation.title"
                ),
                children: (
                  <HStack spacing={2}>
                    <Slider
                      min={256}
                      max={maxMemCanAllocated || 8192}
                      step={16}
                      w={32}
                      colorScheme={primaryColor}
                      value={globalGameConfigs.performance.minMemAllocation}
                      onChange={(value) => {
                        if (instanceId) return; // TBD
                        update(
                          "globalGameConfig.performance.minMemAllocation",
                          value
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
                      value={globalGameConfigs.performance.minMemAllocation}
                      onChange={(value) => {
                        if (instanceId) return; // TBD
                        update(
                          "globalGameConfig.performance.minMemAllocation",
                          Number(value)
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
          allocatedMemory={globalGameConfigs.performance.minMemAllocation}
        />,
        {
          title: t(
            "GlobalGameSettingsPage.performance.settings.processPriority.title"
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
                  `GlobalGameSettingsPage.performance.settings.processPriority.${globalGameConfigs.performance.processPriority}`
                )}
              </MenuButton>
              <MenuList>
                <MenuOptionGroup
                  value={globalGameConfigs.performance.processPriority}
                  type="radio"
                  onChange={(value) => {
                    if (instanceId) return; // TBD
                    update(
                      "globalGameConfig.performance.processPriority",
                      value
                    );
                  }}
                >
                  {processPriority.map((type) => (
                    <MenuItemOption value={type} fontSize="xs" key={type}>
                      {t(
                        `GlobalGameSettingsPage.performance.settings.processPriority.${type}`
                      )}
                    </MenuItemOption>
                  ))}
                </MenuOptionGroup>
              </MenuList>
            </Menu>
          ),
        },
      ],
    },
    {
      title: t("GlobalGameSettingsPage.gameServer.title"),
      items: [
        {
          title: t(
            "GlobalGameSettingsPage.gameServer.settings.autoJoinGameServer.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={
                globalGameConfigs.gameServer.autoJoinGameServer.enabled
              }
              onChange={(event) => {
                if (instanceId) return; // TBD
                update(
                  "globalGameConfig.gameServer.autoJoinGameServer.enabled",
                  event.target.checked
                );
              }}
            />
          ),
        },
        ...(globalGameConfigs.gameServer.autoJoinGameServer.enabled
          ? [
              {
                title: t(
                  "GlobalGameSettingsPage.gameServer.settings.autoJoinGameServer.serverUrl"
                ),
                children: (
                  <Input
                    size="xs"
                    w={64}
                    value={
                      globalGameConfigs.gameServer.autoJoinGameServer.gameServer
                    }
                    onChange={(event) => {
                      if (instanceId) return; // TBD
                      update(
                        "globalGameConfig.gameServer.autoJoinGameServer.gameServer",
                        event.target.value
                      );
                    }}
                    focusBorderColor={`${primaryColor}.500`}
                  />
                ),
              },
            ]
          : []),
      ],
    },
    {
      title: t("GlobalGameSettingsPage.moreOptions.title"),
      items: [
        {
          title: t(
            "GlobalGameSettingsPage.versionIsolation.settings.enabled.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={globalGameConfigs.versionIsolation.enabled}
              onChange={(event) => {
                if (instanceId) return; // TBD
                update(
                  "globalGameConfig.versionIsolation.enabled",
                  event.target.checked
                );
              }}
            />
          ),
        },
        {
          title: t(
            "GlobalGameSettingsPage.moreOptions.settings.launcherVisibility.title"
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
                  `GlobalGameSettingsPage.moreOptions.settings.launcherVisibility.${globalGameConfigs.launcherVisibility}`
                )}
              </MenuButton>
              <MenuList>
                <MenuOptionGroup
                  type="radio"
                  value={globalGameConfigs.launcherVisibility}
                  onChange={(value) => {
                    if (instanceId) return; // TBD
                    update("globalGameConfig.launcherVisibility", value);
                  }}
                >
                  {launcherVisibilityStrategy.map((type) => (
                    <MenuItemOption value={type} fontSize="xs" key={type}>
                      {t(
                        `GlobalGameSettingsPage.moreOptions.settings.launcherVisibility.${type}`
                      )}
                    </MenuItemOption>
                  ))}
                </MenuOptionGroup>
              </MenuList>
            </Menu>
          ),
        },
        {
          title: t(
            "GlobalGameSettingsPage.moreOptions.settings.displayGameLog.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={globalGameConfigs.displayGameLog}
              onChange={(event) => {
                if (instanceId) return; // TBD
                update("globalGameConfig.displayGameLog", event.target.checked);
              }}
            />
          ),
        },
        {
          title: t(
            "GlobalGameSettingsPage.moreOptions.settings.enableAdvancedOptions.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={globalGameConfigs.advancedOptions.enabled}
              onChange={(event) => {
                if (instanceId) return; // TBD
                update(
                  "globalGameConfig.advancedOptions.enabled",
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
    <VStack overflow="auto" align="strench" spacing={4} flex="1">
      {settingGroups.map((group, index) => (
        <OptionItemGroup title={group.title} items={group.items} key={index} />
      ))}
    </VStack>
  );
};

export default GameSettingsGroups;

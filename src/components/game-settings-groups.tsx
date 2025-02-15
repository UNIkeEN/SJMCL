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
  Portal,
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
import { JavaInfo } from "@/models/system-info";
import { retriveMemoryInfo } from "@/services/utils";

interface GameSettingsGroupsProps {
  instanceId?: number;
}

const GameSettingsGroups: React.FC<GameSettingsGroupsProps> = ({
  instanceId = 0,
}) => {
  const { t } = useTranslation();
  const { config, update, getJavaInfos } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const globalGameConfigs = config.globalGameConfig;

  const [javaInfos, setJavaInfos] = useState<JavaInfo[]>([]);

  const buildJavaMenuLabel = (java: JavaInfo | undefined) => {
    if (!java) return "";
    return `Java ${java.majorVersion}${java.isLts ? " (LTS)" : ""} (${java.execPath})`;
  };

  useEffect(() => {
    setJavaInfos(getJavaInfos() || []);
  }, [getJavaInfos]);

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
      title: t("GlobalGameSettingsPage.gameJava.title"),
      items: [
        {
          title: t("GlobalGameSettingsPage.gameJava.settings.autoSelect.title"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={globalGameConfigs.gameJava.auto}
              onChange={(event) => {
                if (instanceId) return; // TBD
                update("globalGameConfig.gameJava.auto", event.target.checked);
              }}
            />
          ),
        },
        ...(globalGameConfigs.gameJava.auto
          ? []
          : [
              {
                title: t(
                  "GlobalGameSettingsPage.gameJava.settings.execPath.title"
                ),
                children: (
                  <Menu>
                    <MenuButton
                      as={Button}
                      size="xs"
                      w="auto"
                      maxW="80%"
                      variant="outline"
                    >
                      <HStack spacing={1}>
                        <Text noOfLines={1}>
                          {buildJavaMenuLabel(
                            javaInfos.find(
                              (java) =>
                                java.execPath ===
                                globalGameConfigs.gameJava.execPath
                            )
                          )}
                        </Text>
                        <LuChevronDown />
                      </HStack>
                    </MenuButton>
                    <Portal>
                      <MenuList>
                        <MenuOptionGroup
                          value={globalGameConfigs.gameJava.execPath}
                          type="radio"
                          onChange={(value) => {
                            if (instanceId) return; // TBD
                            update("globalGameConfig.gameJava.execPath", value);
                          }}
                        >
                          {javaInfos.map((java) => (
                            <MenuItemOption
                              value={java.execPath}
                              fontSize="xs"
                              key={java.execPath}
                            >
                              <Text>{buildJavaMenuLabel(java)}</Text>
                            </MenuItemOption>
                          ))}
                        </MenuOptionGroup>
                      </MenuList>
                    </Portal>
                  </Menu>
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
                value={globalGameConfigs.gameWindow.resolution.width}
                onChange={(value) => {
                  if (instanceId) return; // TBD
                  update(
                    "globalGameConfig.gameWindow.resolution.width",
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
                value={globalGameConfigs.gameWindow.resolution.height}
                onChange={(value) => {
                  if (instanceId) return; // TBD
                  update(
                    "globalGameConfig.gameWindow.resolution.height",
                    Number(value)
                  );
                }}
              >
                <NumberInputField pr={0} />
              </NumberInput>
              <Switch
                colorScheme={primaryColor}
                isChecked={globalGameConfigs.gameWindow.resolution.fullscreen}
                onChange={(event) => {
                  if (instanceId) return; // TBD
                  update(
                    "globalGameConfig.gameWindow.resolution.fullscreen",
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
              value={globalGameConfigs.gameWindow.customTitle}
              onChange={(event) => {
                if (instanceId) return; // TBD
                update(
                  "globalGameConfig.gameWindow.customTitle",
                  event.target.value
                );
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
              value={globalGameConfigs.gameWindow.customInfo}
              onChange={(event) => {
                if (instanceId) return; // TBD
                update(
                  "globalGameConfig.gameWindow.customInfo",
                  event.target.value
                );
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
      title: t("GlobalGameSettingsPage.moreOptions.title"),
      items: [
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
            "GlobalGameSettingsPage.moreOptions.settings.autoJoinGameServer.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={globalGameConfigs.gameServer.autoJoin}
              onChange={(event) => {
                if (instanceId) return; // TBD
                update(
                  "globalGameConfig.gameServer.autoJoin",
                  event.target.checked
                );
              }}
            />
          ),
        },
        ...(globalGameConfigs.gameServer.autoJoin
          ? [
              {
                title: t(
                  "GlobalGameSettingsPage.moreOptions.settings.serverUrl.title"
                ),
                children: (
                  <Input
                    size="xs"
                    w={64}
                    value={globalGameConfigs.gameServer.serverUrl}
                    onChange={(event) => {
                      if (instanceId) return; // TBD
                      update(
                        "globalGameConfig.gameServer.serverUrl",
                        event.target.value
                      );
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

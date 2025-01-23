import {
  Button,
  Flex,
  HStack,
  IconButton,
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
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuChevronDown,
  LuFolder,
  LuFolderOpen,
  LuPlus,
  LuTrash,
} from "react-icons/lu";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import MemoryStatusProgress from "@/components/memory-status-progress";
import { useLauncherConfig } from "@/contexts/config";
import { MemoryInfo } from "@/models/misc";
import { getMemoryInfo } from "@/services/utils";

const GlobalGameSettingsPage = () => {
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

  const fetchMemoryInfo = async () => {
    getMemoryInfo()
      .then((info) => {
        setMemoryInfo(info);
      })
      .catch((error) => {});
  };

  useEffect(() => {
    fetchMemoryInfo();
    const interval = setInterval(fetchMemoryInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  const globalGameSettingGroups: OptionItemGroupProps[] = [
    {
      title: t("GlobalGameSettingsPage.directories.title"),
      items: [
        {
          title: t(
            "GlobalGameSettingsPage.directories.settings.directories.title"
          ),
          children: (
            <Tooltip
              label={t(
                "GlobalGameSettingsPage.directories.settings.directories.add"
              )}
              placement="top"
            >
              <IconButton // TBD
                aria-label="add"
                variant="ghost"
                size="xs"
                icon={<LuPlus />}
                h={21}
              />
            </Tooltip>
          ),
        },
        <VStack key="dir-list" ml={1.5} spacing={0.5}>
          {config.localGameDirectories.map((dir) => (
            <Flex key={dir} alignItems="center" w="100%">
              <HStack>
                <LuFolder size={12} />
                <Text fontSize="xs" className="secondary-text">
                  {dir}
                </Text>
              </HStack>
              <HStack spacing={1} ml="auto">
                <Tooltip label={t("General.openFolder")}>
                  <IconButton // TBD
                    aria-label="openFolder"
                    variant="ghost"
                    size="xs"
                    icon={<LuFolderOpen />}
                    h={21}
                  />
                </Tooltip>
                <Tooltip label={t("General.delete")}>
                  <IconButton // TBD
                    aria-label="openFolder"
                    variant="ghost"
                    size="xs"
                    icon={<LuTrash />}
                    h={21}
                    colorScheme="red"
                  />
                </Tooltip>
              </HStack>
            </Flex>
          ))}
        </VStack>,
      ],
    },
    {
      title: t("GlobalGameSettingsPage.performance.title"),
      items: [
        {
          title: t(
            "GlobalGameSettingsPage.performance.settings.gameWindowResolution.title"
          ),
          children: (
            <HStack>
              <NumberInput
                min={400}
                size="xs"
                maxW={16}
                value={globalGameConfigs.performance.gameWindowResolution.width}
                onChange={(value) => {
                  update(
                    "globalGameConfig.performance.gameWindowResolution.width",
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
                value={
                  globalGameConfigs.performance.gameWindowResolution.height
                }
                onChange={(value) => {
                  update(
                    "globalGameConfig.performance.gameWindowResolution.height",
                    Number(value)
                  );
                }}
              >
                <NumberInputField pr={0} />
              </NumberInput>
              <Switch
                colorScheme={primaryColor}
                isChecked={
                  globalGameConfigs.performance.gameWindowResolution.fullscreen
                }
                onChange={(event) => {
                  update(
                    "globalGameConfig.performance.gameWindowResolution.fullscreen",
                    event.target.checked
                  );
                }}
              />
              <Text fontSize="xs">
                {t(
                  "GlobalGameSettingsPage.performance.settings.gameWindowResolution.switch"
                )}
              </Text>
            </HStack>
          ),
        },
        {
          title: t(
            "GlobalGameSettingsPage.performance.settings.autoMemAllocation.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={globalGameConfigs.performance.autoMemAllocation}
              onChange={(event) => {
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
                      value={globalGameConfigs.performance.minMemAllocation}
                      onChange={(value) => {
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
      title: t("GlobalGameSettingsPage.versionIsolation.title"),
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
                update(
                  "globalGameConfig.versionIsolation.enabled",
                  event.target.checked
                );
              }}
            />
          ),
        },
        ...(globalGameConfigs.versionIsolation.enabled
          ? [
              {
                title: t(
                  "GlobalGameSettingsPage.versionIsolation.settings.isolationStrategy.title"
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
                        `GlobalGameSettingsPage.versionIsolation.settings.isolationStrategy.${globalGameConfigs.versionIsolation.isolationStrategy}`
                      )}
                    </MenuButton>
                    <MenuList>
                      <MenuOptionGroup
                        type="radio"
                        value={
                          globalGameConfigs.versionIsolation.isolationStrategy
                        }
                        onChange={(value) => {
                          update(
                            "globalGameConfig.versionIsolation.isolationStrategy",
                            value
                          );
                        }}
                      >
                        {isolationStrategy.map((type) => (
                          <MenuItemOption value={type} fontSize="xs" key={type}>
                            {t(
                              `GlobalGameSettingsPage.versionIsolation.settings.isolationStrategy.${type}`
                            )}
                          </MenuItemOption>
                        ))}
                      </MenuOptionGroup>
                    </MenuList>
                  </Menu>
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
    <>
      {globalGameSettingGroups.map((group, index) => (
        <OptionItemGroup title={group.title} items={group.items} key={index} />
      ))}
    </>
  );
};

export default GlobalGameSettingsPage;

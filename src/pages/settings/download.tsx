import {
  Button,
  HStack,
  Input,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Switch,
  Text,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { open as openFolder } from "@tauri-apps/plugin-shell";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import SegmentedControl from "@/components/common/segmented";
import { useLauncherConfig } from "@/contexts/config";

const DownloadSettingsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const downloadConfigs = config.download;
  const primaryColor = config.appearance.theme.primaryColor;

  const [concurrentCount, setConcurrentCount] = useState<number>(
    downloadConfigs.transmission.concurrentCount
  );
  const [speedLimitValue, setSpeedLimitValue] = useState<number>(
    downloadConfigs.transmission.speedLimitValue
  );
  const [proxyPort, setProxyPort] = useState<number>(
    downloadConfigs.proxy.port
  );
  const [proxyHost, setProxyHost] = useState<string>(
    downloadConfigs.proxy.host
  );

  const sourceStrategyTypes = ["auto", "official", "mirror"];
  const proxyTypeOptions = [
    {
      label: "HTTP",
      value: "http",
    },
    {
      label: "Socks",
      value: "socks",
    },
  ];

  const handleSelectDirectory = async () => {
    const selectedDirectory = await open({
      directory: true,
      multiple: false,
      defaultPath: downloadConfigs.cache.directory,
    });
    if (selectedDirectory && typeof selectedDirectory === "string") {
      update("download.cache.directory", selectedDirectory);
    } else if (selectedDirectory === null) {
      console.log("Directory selection was cancelled.");
    }
  };

  const downloadSettingGroups: OptionItemGroupProps[] = [
    {
      title: t("DownloadSettingPage.source.title"),
      items: [
        {
          title: t("DownloadSettingPage.source.settings.strategy.title"),
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
                  `DownloadSettingPage.source.settings.strategy.${downloadConfigs.source.strategy}`
                )}
              </MenuButton>
              <MenuList>
                <MenuOptionGroup
                  value={downloadConfigs.source.strategy}
                  type="radio"
                  onChange={(value) => {
                    update("download.source.strategy", value);
                  }}
                >
                  {sourceStrategyTypes.map((type) => (
                    <MenuItemOption value={type} fontSize="xs" key={type}>
                      {t(
                        `DownloadSettingPage.source.settings.strategy.${type}`
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
      title: t("DownloadSettingPage.download.title"),
      items: [
        {
          title: t(
            "DownloadSettingPage.download.settings.autoConcurrent.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={downloadConfigs.transmission.autoConcurrent}
              onChange={(event) => {
                update(
                  "download.transmission.autoConcurrent",
                  event.target.checked
                );
              }}
            />
          ),
        },
        ...(downloadConfigs.transmission.autoConcurrent
          ? []
          : [
              {
                title: t(
                  "DownloadSettingPage.download.settings.concurrentCount.title"
                ),
                children: (
                  <HStack spacing={4}>
                    <Slider
                      min={1}
                      max={128}
                      step={1}
                      w={32}
                      colorScheme={primaryColor}
                      value={concurrentCount}
                      onChange={(value) => {
                        setConcurrentCount(value);
                      }}
                      onBlur={() => {
                        update(
                          "download.transmission.concurrentCount",
                          concurrentCount
                        );
                      }}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                    <NumberInput
                      min={1}
                      max={128}
                      size="xs"
                      maxW={16}
                      focusBorderColor={`${primaryColor}.500`}
                      value={concurrentCount}
                      onChange={(value) => {
                        setConcurrentCount(Number(value));
                      }}
                      onBlur={() => {
                        setConcurrentCount(
                          Math.max(1, Math.min(concurrentCount, 128))
                        );
                      }}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper>
                          <LuChevronUp size={8} />
                        </NumberIncrementStepper>
                        <NumberDecrementStepper>
                          <LuChevronDown size={8} />
                        </NumberDecrementStepper>
                      </NumberInputStepper>
                    </NumberInput>
                  </HStack>
                ),
              },
            ]),
        {
          title: t(
            "DownloadSettingPage.download.settings.enableSpeedLimit.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={downloadConfigs.transmission.enableSpeedLimit}
              onChange={(event) => {
                update(
                  "download.transmission.enableSpeedLimit",
                  event.target.checked
                );
              }}
            />
          ),
        },
        ...(downloadConfigs.transmission.enableSpeedLimit
          ? [
              {
                title: t(
                  "DownloadSettingPage.download.settings.speedLimitValue.title"
                ),
                children: (
                  <HStack>
                    <NumberInput
                      min={1}
                      size="xs"
                      maxW={16}
                      focusBorderColor={`${primaryColor}.500`}
                      value={speedLimitValue}
                      onChange={(value) => {
                        setSpeedLimitValue(Number(value));
                      }}
                      onBlur={() => {
                        update(
                          "download.transmission.speedLimitValue",
                          Math.max(1, Math.min(speedLimitValue, 2 ** 32 - 1))
                        );
                      }}
                    >
                      {/* no stepper NumberInput, use pr={0} */}
                      <NumberInputField pr={0} />
                    </NumberInput>
                    <Text fontSize="xs">KB/s</Text>
                  </HStack>
                ),
              },
            ]
          : []),
      ],
    },
    {
      title: t("DownloadSettingPage.cache.title"),
      items: [
        {
          title: t("DownloadSettingPage.cache.settings.directory.title"),
          description: downloadConfigs.cache.directory,
          children: (
            <HStack>
              <Button
                variant="subtle"
                size="xs"
                onClick={handleSelectDirectory}
              >
                {t("DownloadSettingPage.cache.settings.directory.select")}
              </Button>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => {
                  openFolder(downloadConfigs.cache.directory);
                }}
              >
                {t("DownloadSettingPage.cache.settings.directory.open")}
              </Button>
            </HStack>
          ),
        },
      ],
    },
    {
      title: t("DownloadSettingPage.proxy.title"),
      items: [
        {
          title: t("DownloadSettingPage.proxy.settings.enabled.title"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={downloadConfigs.proxy.enabled}
              onChange={(event) => {
                update("download.proxy.enabled", event.target.checked);
              }}
            />
          ),
        },
        ...(downloadConfigs.proxy.enabled
          ? [
              {
                title: t("DownloadSettingPage.proxy.settings.type.title"),
                children: (
                  <HStack>
                    <SegmentedControl
                      selected={downloadConfigs.proxy.selectedType}
                      onSelectItem={(s) => {
                        update("download.proxy.selectedType", s as string);
                      }}
                      size="xs"
                      items={proxyTypeOptions}
                    />
                  </HStack>
                ),
              },
              {
                title: t("DownloadSettingPage.proxy.settings.host.title"),
                children: (
                  <Input
                    size="xs"
                    w="107px" // align with the segmented-control above
                    focusBorderColor={`${primaryColor}.500`}
                    value={proxyHost}
                    onChange={(event) => {
                      setProxyHost(event.target.value);
                    }}
                    onBlur={() => {
                      update("download.proxy.host", proxyHost);
                    }}
                  />
                ),
              },
              {
                title: t("DownloadSettingPage.proxy.settings.port.title"),
                children: (
                  <NumberInput
                    size="xs"
                    maxW={16}
                    min={0}
                    max={65535}
                    focusBorderColor={`${primaryColor}.500`}
                    value={proxyPort || 80}
                    onChange={(value) => {
                      setProxyPort(Number(value));
                    }}
                    onBlur={() => {
                      update(
                        "download.proxy.port",
                        Math.max(0, Math.min(proxyPort || 80, 65535))
                      );
                    }}
                  >
                    <NumberInputField pr={0} />
                  </NumberInput>
                ),
              },
            ]
          : []),
      ],
    },
  ];

  return (
    <>
      {downloadSettingGroups.map((group, index) => (
        <OptionItemGroup title={group.title} items={group.items} key={index} />
      ))}
    </>
  );
};

export default DownloadSettingsPage;

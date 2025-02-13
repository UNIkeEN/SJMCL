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
import { downloadDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { open as openFolder } from "@tauri-apps/plugin-shell";
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
                      value={downloadConfigs.transmission.concurrentCount}
                      onChange={(value) => {
                        update("download.transmission.concurrentCount", value);
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
                      value={downloadConfigs.transmission.concurrentCount}
                      onChange={(value) => {
                        update(
                          "download.transmission.concurrentCount",
                          Number(value)
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
                      value={downloadConfigs.transmission.speedLimitValue}
                      onChange={(value) => {
                        update(
                          "download.transmission.speedLimitValue",
                          Number(value)
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
                    value={downloadConfigs.proxy.host}
                    onChange={(event) => {
                      update("download.proxy.host", event.target.value);
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
                    value={downloadConfigs.proxy.port || 80}
                    onChange={(value) => {
                      update("download.proxy.port", Number(value));
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

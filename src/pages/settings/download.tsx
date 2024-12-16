import {
  Button,
  HStack,
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
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";

const DownloadSettingsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const downloadConfigs = config.download;
  const primaryColor = config.appearance.theme.primaryColor;

  const sourceStrategyTypes = ["auto", "official", "mirror"];

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

  const handleOpenDirectory = () => {
    openFolder(downloadConfigs.cache.directory);
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
              isChecked={downloadConfigs.download.autoConcurrent}
              onChange={(event) => {
                update(
                  "download.download.autoConcurrent",
                  event.target.checked
                );
              }}
            />
          ),
        },
        ...(downloadConfigs.download.autoConcurrent
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
                      value={downloadConfigs.download.concurrentCount}
                      onChange={(value) => {
                        update("download.download.concurrentCount", value);
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
                      value={downloadConfigs.download.concurrentCount}
                      onChange={(value) => {
                        update(
                          "download.download.concurrentCount",
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
              isChecked={downloadConfigs.download.enableSpeedLimit}
              onChange={(event) => {
                update(
                  "download.download.enableSpeedLimit",
                  event.target.checked
                );
              }}
            />
          ),
        },
        ...(downloadConfigs.download.enableSpeedLimit
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
                      value={downloadConfigs.download.speedLimitValue}
                      onChange={(value) => {
                        update(
                          "download.download.speedLimitValue",
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
              <Button variant="subtle" size="xs" onClick={handleOpenDirectory}>
                {t("DownloadSettingPage.cache.settings.directory.open")}
              </Button>
            </HStack>
          ),
        },
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

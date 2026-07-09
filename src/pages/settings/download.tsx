import {
  Box,
  Button,
  HStack,
  Icon,
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
import { openPath } from "@tauri-apps/plugin-opener";
import { useRouter } from "next/router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";
import { LuArrowRight } from "react-icons/lu";
import { MenuSelector } from "@/components/common/menu-selector";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useProxySettingsItems } from "@/components/common/proxy-settings-group";
import { useLauncherConfig } from "@/contexts/config";
import { useSharedModals } from "@/contexts/shared-modal";
import { useTaskContext } from "@/contexts/task";
import { useToast } from "@/contexts/toast";
import { GTaskEventStatusEnums } from "@/models/task";
import { ConfigService } from "@/services/config";

const DownloadSettingsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { openGenericConfirmDialog, closeSharedModal } = useSharedModals();
  const router = useRouter();

  const { config, update } = useLauncherConfig();
  const downloadConfigs = config.download;
  const primaryColor = config.appearance.theme.primaryColor;

  const { tasks } = useTaskContext();
  const hasActiveDownloadTasks = tasks.some(
    (taskGroup) =>
      !(
        taskGroup.status === GTaskEventStatusEnums.Completed ||
        taskGroup.status === GTaskEventStatusEnums.Failed
      )
  );

  const [concurrentCount, setConcurrentCount] = useState<number>(
    downloadConfigs.transmission.concurrentCount
  );
  const [sliderConcurrentCount, setSliderConcurrentCount] = useState<number>(
    downloadConfigs.transmission.concurrentCount
  );
  const [speedLimitValue, setSpeedLimitValue] = useState<number>(
    downloadConfigs.transmission.speedLimitValue
  );
  const [isClearingDownloadCache, setIsClearingDownloadCache] =
    useState<boolean>(false);

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
      logger.info("Directory selection was cancelled.");
    }
  };

  const handleClearDownloadCache = () => {
    if (isClearingDownloadCache || hasActiveDownloadTasks) {
      return;
    }
    setIsClearingDownloadCache(true);
    ConfigService.clearDownloadCache()
      .then((response) => {
        if (response.status === "success") {
          toast({
            title: response.message,
            status: "success",
          });
        } else {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
      })
      .finally(() => {
        setIsClearingDownloadCache(false);
      });
    closeSharedModal("generic-confirm");
  };

  const downloadSettingGroups: OptionItemGroupProps[] = [
    {
      items: [
        {
          title: t("DownloadTasksPage.title"),
          children: <Icon as={LuArrowRight} boxSize={3.5} mr="5px" />,
          isFullClickZone: true,
          onClick: () => router.push("/downloads"),
        },
        {
          title: t("PingTestPage.PingServerList.title"),
          children: <Icon as={LuArrowRight} boxSize={3.5} mr="5px" />,
          isFullClickZone: true,
          onClick: () => router.push("/settings/ping-test"),
        },
      ],
    },
    {
      title: t("DownloadSettingPage.source.title"),
      items: [
        {
          title: t("DownloadSettingPage.source.settings.strategy.title"),
          children: (
            <MenuSelector
              options={sourceStrategyTypes.map((type) => ({
                value: type,
                label: t(
                  `DownloadSettingPage.source.settings.strategy.${type}`
                ),
              }))}
              value={downloadConfigs.source.strategy}
              onSelect={(value) =>
                update("download.source.strategy", value as string)
              }
              placeholder={t(
                `DownloadSettingPage.source.settings.strategy.${downloadConfigs.source.strategy}`
              )}
            />
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
                      value={sliderConcurrentCount}
                      onChange={(value) => {
                        setSliderConcurrentCount(value);
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
                        if (!/^\d*$/.test(value)) return;
                        setConcurrentCount(Number(value));
                      }}
                      onBlur={() => {
                        setSliderConcurrentCount(concurrentCount);
                        update(
                          "download.transmission.concurrentCount",
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
                        if (!/^\d*$/.test(value)) return;
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
                    <Text fontSize="xs">KiB/s</Text>
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
          description: (
            <Text
              fontSize="xs"
              className="secondary-text"
              wordBreak="break-all"
            >
              {downloadConfigs.cache.directory}
            </Text>
          ),
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
                onClick={async () => {
                  await openPath(downloadConfigs.cache.directory);
                }}
              >
                {t("General.open")}
              </Button>
            </HStack>
          ),
        },
        {
          title: t("DownloadSettingPage.cache.settings.clear.title"),
          description: hasActiveDownloadTasks ? (
            <Text fontSize="xs" color="red.600">
              {t(
                "Services.config.clearDownloadCache.error.description.HAS_ACTIVE_DOWNLOAD_TASKS"
              )}
            </Text>
          ) : (
            t("DownloadSettingPage.cache.settings.clear.description")
          ),
          children: (
            <Button
              variant="subtle"
              size="xs"
              colorScheme="red"
              isLoading={isClearingDownloadCache}
              onClick={() =>
                openGenericConfirmDialog({
                  title: t("ClearDownloadCacheAlertDialog.dialog.title"),
                  body: t("ClearDownloadCacheAlertDialog.dialog.content"),
                  btnOK: t("General.delete"),
                  isAlert: true,
                  onOKCallback: handleClearDownloadCache,
                })
              }
              disabled={hasActiveDownloadTasks}
            >
              {t("DownloadSettingPage.cache.settings.clear.button")}
            </Button>
          ),
        },
      ],
    },
    {
      title: t("DownloadSettingPage.proxy.title"),
      headExtra: (
        <Box display="flex" alignItems="center">
          <Text fontSize="xs" className="secondary-text">
            {t("DownloadSettingPage.proxy.headExtra")}
          </Text>
        </Box>
      ),
      items: useProxySettingsItems(
        "DownloadSettingPage.proxy",
        downloadConfigs.proxy,
        (key, value) => update(`download.proxy.${key}`, value)
      ),
    },
  ];

  return (
    <>
      {downloadSettingGroups.map((group, index) => (
        <OptionItemGroup key={index} {...group} />
      ))}
    </>
  );
};

export default DownloadSettingsPage;

import {
  Avatar,
  AvatarGroup,
  Box,
  BoxProps,
  Button,
  Center,
  Grid,
  HStack,
  Icon,
  IconButton,
  Image,
  Text,
  Tooltip,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import {
  LuArrowRight,
  LuBookDashed,
  LuBox,
  LuCalendarClock,
  LuClock4,
  LuEarth,
  LuFullscreen,
  LuHaze,
  LuPackage,
  LuSettings,
  LuShapes,
  LuSquareLibrary,
} from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import Empty from "@/components/common/empty";
import { OptionItem } from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { ModLoaderType } from "@/enums/instance";
import { GetStateFlag } from "@/hooks/get-state";
import { LocalModInfo } from "@/models/instance/misc";
import { ScreenshotInfo } from "@/models/instance/misc";
import { WorldInfo } from "@/models/instance/world";
import {
  UNIXToISOString,
  formatRelativeTime,
  formatTimeInterval,
} from "@/utils/datetime";
import { parseModLoaderVersion } from "@/utils/instance";
import { base64ImgSrc } from "@/utils/string";

// All these widgets are used in InstanceContext with WarpCard wrapped.
interface InstanceWidgetBaseProps extends Omit<BoxProps, "children"> {
  title?: string;
  children: React.ReactNode;
  icon?: IconType;
}

const InstanceWidgetBase: React.FC<InstanceWidgetBaseProps> = ({
  title,
  children,
  icon,
  ...props
}) => {
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const backIconColor = `${primaryColor}.${useColorModeValue(100, 900)}`;

  return (
    <VStack align="stretch" spacing={2} {...props}>
      {title && (
        <Text
          fontSize="md"
          fontWeight="bold"
          lineHeight="16px" // the same as fontSize 'md'
          mb={1}
          zIndex={999}
          color="white"
          mixBlendMode="exclusion"
          noOfLines={1}
        >
          {title}
        </Text>
      )}
      {children}
      {icon && (
        <Icon
          as={icon}
          position="absolute"
          color={backIconColor}
          boxSize={20}
          bottom={-5}
          right={-5}
        />
      )}
    </VStack>
  );
};

export const InstanceBasicInfoWidget = () => {
  const { t } = useTranslation();
  const { summary } = useInstanceSharedData();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  return (
    <InstanceWidgetBase
      title={t("InstanceWidgets.basicInfo.title")}
      icon={LuBox}
      mr={-4} // ref: https://github.com/UNIkeEN/SJMCL/issues/762
    >
      <OptionItem
        title={t("InstanceWidgets.basicInfo.gameVersion")}
        description={
          <VStack
            spacing={0}
            fontSize="xs"
            alignItems="flex-start"
            className="secondary-text"
            wordBreak="break-all"
          >
            {summary?.version && <Text noOfLines={1}>{summary.version}</Text>}
            {summary?.modLoader.loaderType &&
              summary?.modLoader.loaderType !== ModLoaderType.Unknown && (
                <Text
                  noOfLines={1}
                >{`${summary?.modLoader.loaderType} ${parseModLoaderVersion(summary?.modLoader.version || "")}`}</Text>
              )}
          </VStack>
        }
        prefixElement={
          <Image src={summary?.iconSrc} alt={summary?.iconSrc} boxSize="28px" />
        }
        zIndex={998}
      />
      <OptionItem
        title={t("InstanceWidgets.basicInfo.playTime")}
        description={formatTimeInterval(summary?.playTime || 0)}
        prefixElement={
          <Center
            boxSize={7}
            color={`${primaryColor}.${useColorModeValue(600, 200)}`}
          >
            <LuCalendarClock fontSize="24px" />
          </Center>
        }
        zIndex={998}
      />
    </InstanceWidgetBase>
  );
};

export const InstanceScreenshotsWidget = () => {
  const { t } = useTranslation();
  const { getScreenshotList, isScreenshotListLoading: isLoading } =
    useInstanceSharedData();
  const router = useRouter();
  const { id } = router.query;
  const instanceId = Array.isArray(id) ? id[0] : id;

  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const hasScreenshots = screenshots && screenshots.length;

  const getScreenshotListWrapper = useCallback(
    (sync?: boolean) => {
      getScreenshotList(sync)
        .then((data) => {
          if (data === GetStateFlag.Cancelled) return; // do not update state if cancelled
          setScreenshots(data || []);
        })
        .catch((e) => setScreenshots([] as ScreenshotInfo[]));
    },
    [getScreenshotList]
  );

  useEffect(() => {
    getScreenshotListWrapper();
  }, [getScreenshotListWrapper]);

  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (screenshots.length >= 2) {
      const interval = setInterval(() => {
        setIsFading(true);
        setTimeout(() => {
          setCurrentIndex((prevIndex) => (prevIndex + 1) % screenshots.length);
          setIsFading(false);
        }, 800);
      }, 8000);

      return () => clearInterval(interval);
    }
  }, [screenshots]);

  return (
    <InstanceWidgetBase
      title={t("InstanceWidgets.screenshots.title")}
      style={{ cursor: "pointer" }}
      {...(hasScreenshots ? {} : { icon: LuFullscreen })}
    >
      {isLoading ? (
        <Center mt={4}>
          <BeatLoader size={8} color="gray" />
        </Center>
      ) : hasScreenshots ? (
        <Image
          src={convertFileSrc(screenshots[currentIndex].filePath)}
          alt={screenshots[currentIndex].fileName}
          objectFit="cover"
          position="absolute"
          borderRadius="md"
          w="100%"
          h="100%"
          ml={-3}
          mt={-3}
          opacity={isFading ? 0 : 1}
          transition="opacity 0.8s ease-in-out"
          onClick={() => {
            router.push(
              {
                pathname: `/instances/details/${encodeURIComponent(instanceId || "")}/screenshots`,
                query: {
                  screenshotIndex: currentIndex.toString(),
                },
              },
              undefined,
              { shallow: true }
            );
          }}
        />
      ) : (
        <Empty withIcon={false} size="sm" />
      )}
    </InstanceWidgetBase>
  );
};

export const InstanceModsWidget = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = router.query;
  const instanceId = Array.isArray(id) ? id[0] : id;
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { getLocalModList, isLocalModListLoading: isLoading } =
    useInstanceSharedData();

  const [localMods, setLocalMods] = useState<LocalModInfo[]>([]);

  const getLocalModListWrapper = useCallback(
    (sync?: boolean) => {
      getLocalModList(sync)
        .then((data) => {
          if (data === GetStateFlag.Cancelled) return; // do not update state if cancelled
          setLocalMods(data || []);
        })
        .catch((e) => setLocalMods([] as LocalModInfo[]));
    },
    [getLocalModList]
  );

  useEffect(() => {
    getLocalModListWrapper();
  }, [getLocalModListWrapper]);

  const totalMods = localMods.length;
  const enabledMods = localMods.filter((mod) => mod.enabled).length;

  return (
    <InstanceWidgetBase
      title={t("InstanceWidgets.mods.title")}
      icon={LuSquareLibrary}
    >
      <VStack align="stretch" w="100%" spacing={3} zIndex={998}>
        {isLoading ? (
          <Center mt={4}>
            <BeatLoader size={8} color="gray" />
          </Center>
        ) : localMods.length > 0 ? (
          <>
            <AvatarGroup size="sm" max={5} spacing={-2.5}>
              {localMods.map((mod, index) => (
                <Avatar
                  key={index}
                  name={mod.name || mod.fileName}
                  src={base64ImgSrc(mod.iconSrc)}
                  style={{
                    filter: mod.enabled ? "none" : "grayscale(90%)",
                  }}
                />
              ))}
            </AvatarGroup>
            <Text fontSize="xs" color="gray.500">
              {t("InstanceWidgets.mods.summary", { totalMods, enabledMods })}
            </Text>
          </>
        ) : (
          <Empty withIcon={false} size="sm" />
        )}
        <Button
          size="xs"
          variant="ghost"
          position="absolute"
          left={2}
          bottom={2}
          justifyContent="flex-start"
          colorScheme={primaryColor}
          onClick={() => {
            router.push(
              `/instances/details/${encodeURIComponent(instanceId || "")}/mods`
            );
          }}
        >
          <HStack spacing={1.5}>
            <Icon as={LuArrowRight} />
            <Text>{t("InstanceWidgets.mods.manage")}</Text>
          </HStack>
        </Button>
      </VStack>
    </InstanceWidgetBase>
  );
};

export const InstanceLastPlayedWidget = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const { openSharedModal } = useSharedModals();
  const { summary } = useInstanceSharedData();
  const { getWorldList, isWorldListLoading: isLoading } =
    useInstanceSharedData();
  const primaryColor = config.appearance.theme.primaryColor;

  const [localWorlds, setLocalWorlds] = useState<WorldInfo[]>([]);

  const getWorldListWrapper = useCallback(
    (sync?: boolean) => {
      getWorldList(sync)
        .then((data) => {
          if (data === GetStateFlag.Cancelled) return; // do not update state if cancelled
          setLocalWorlds(data || []);
        })
        .catch((e) => setLocalWorlds([] as WorldInfo[]));
    },
    [getWorldList]
  );

  useEffect(() => {
    getWorldListWrapper();
  }, [getWorldListWrapper]);

  const lastPlayedWorld = localWorlds[0];

  return (
    <InstanceWidgetBase
      title={t("InstanceWidgets.lastPlayed.title")}
      icon={LuClock4}
    >
      {isLoading ? (
        <Center mt={4}>
          <BeatLoader size={8} color="gray" />
        </Center>
      ) : lastPlayedWorld ? (
        <VStack spacing={3} alignItems="flex-start" w="full" zIndex={998}>
          <HStack spacing={3} w="full" alignItems="center">
            <Image
              src={convertFileSrc(lastPlayedWorld.iconSrc)}
              fallbackSrc="/images/icons/UnknownWorld.webp"
              alt={lastPlayedWorld.name}
              boxSize="28px"
              borderRadius="4px"
            />
            <Box flex="1" minW={0}>
              <VStack spacing={0} alignItems="start" w="full">
                <Text fontSize="xs-sm" w="full" isTruncated>
                  {lastPlayedWorld.name}
                </Text>
                <Text className="secondary-text" fontSize="xs">
                  {formatRelativeTime(
                    UNIXToISOString(lastPlayedWorld.lastPlayedAt),
                    t
                  ).replace("on", "")}
                </Text>
                <Text className="secondary-text" fontSize="xs">
                  {t(
                    `InstanceWorldsPage.worldList.gamemode.${lastPlayedWorld.gamemode}`
                  )}
                </Text>
                <Text className="secondary-text" fontSize="xs">
                  {t(
                    `InstanceWorldsPage.worldList.difficulty.${lastPlayedWorld.difficulty}`
                  )}
                </Text>
              </VStack>
            </Box>
          </HStack>
          <HStack spacing={1.5} position="absolute" left={2} bottom={2}>
            <Button
              size="xs"
              variant="ghost"
              colorScheme={primaryColor}
              justifyContent="flex-start"
              onClick={() => {
                openSharedModal("launch", {
                  instanceId: summary?.id,
                  ...(lastPlayedWorld?.dirPath && {
                    quickPlaySingleplayer: lastPlayedWorld.dirPath,
                  }),
                });
              }}
            >
              <HStack spacing={1.5}>
                <Icon as={LuArrowRight} />
                <Text>{t("InstanceWidgets.lastPlayed.continuePlaying")}</Text>
              </HStack>
            </Button>
          </HStack>
        </VStack>
      ) : (
        <Empty withIcon={false} size="sm" />
      )}
    </InstanceWidgetBase>
  );
};

export const InstanceMoreWidget = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const language = config.general.general.language;
  const router = useRouter();
  const { id } = router.query;
  const instanceId = Array.isArray(id) ? id[0] : id;
  const { summary } = useInstanceSharedData();

  const features: Record<string, IconType> = {
    worlds: LuEarth,
    resourcepacks: LuPackage,
    schematics: LuBookDashed,
    shaderpacks: LuHaze,
    settings: LuSettings,
  };

  return (
    <InstanceWidgetBase title={t("InstanceWidgets.more.title")} icon={LuShapes}>
      <Grid templateColumns="repeat(3, 1fr)" rowGap={2}>
        {Object.entries(features).map(([key, icon]) =>
          language.startsWith("zh") ? (
            <Button
              key={key}
              variant="ghost"
              size="lg"
              colorScheme={primaryColor}
              onClick={() =>
                router.push(
                  `/instances/details/${encodeURIComponent(instanceId || "")}/${key}`
                )
              }
            >
              <VStack spacing={1} align="center">
                <Icon as={icon} boxSize="24px" />
                <Text fontSize="xs">
                  {t(`InstanceDetailsLayout.instanceTabList.${key}`)}
                </Text>
              </VStack>
            </Button>
          ) : (
            <Tooltip
              key={key}
              label={t(`InstanceDetailsLayout.instanceTabList.${key}`)}
            >
              <IconButton
                icon={<Icon as={icon} boxSize="32px" />}
                variant="ghost"
                size="lg"
                colorScheme={primaryColor}
                onClick={() =>
                  router.push(
                    `/instances/details/${encodeURIComponent(instanceId || "")}/${key}`
                  )
                }
                aria-label={t(`InstanceDetailsLayout.instanceTabList.${key}`)}
              />
            </Tooltip>
          )
        )}
      </Grid>
    </InstanceWidgetBase>
  );
};

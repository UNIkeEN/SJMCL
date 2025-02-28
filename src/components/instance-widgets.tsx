import {
  Avatar,
  AvatarGroup,
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
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import {
  LuArrowRight,
  LuBookDashed,
  LuBox,
  LuCalendarClock,
  LuClock4,
  LuEarth,
  LuHaze,
  LuPackage,
  LuSettings,
  LuShapes,
  LuSquareLibrary,
} from "react-icons/lu";
import Empty from "@/components/common/empty";
import { OptionItem } from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { LocalModInfo, WorldInfo } from "@/models/instance";
import { ScreenshotInfo } from "@/models/instance";
import { UNIXToISOString, formatRelativeTime } from "@/utils/datetime";
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
          className="no-select"
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
    >
      <OptionItem
        title={t("InstanceWidgets.basicInfo.gameVersion")}
        description={
          <VStack
            spacing={0}
            fontSize="xs"
            alignItems="flex-start"
            className="secondary-text"
          >
            <Text>{summary?.version}</Text>
            {summary?.modLoader.loaderType !== "Unknown" && (
              <Text>{`${summary?.modLoader.loaderType} ${summary?.modLoader.version}`}</Text>
            )}
          </VStack>
        }
        prefixElement={
          <Image src={summary?.iconSrc} alt={summary?.iconSrc} boxSize="28px" />
        }
      />
      <OptionItem
        title={t("InstanceWidgets.basicInfo.playTime")}
        description={"12.1 小时"}
        prefixElement={
          <Center
            boxSize={7}
            color={`${primaryColor}.${useColorModeValue(600, 200)}`}
          >
            <LuCalendarClock fontSize="24px" />
          </Center>
        }
      />
    </InstanceWidgetBase>
  );
};

export const InstanceScreenshotsWidget = () => {
  const { t } = useTranslation();
  const { getScreenshotList } = useInstanceSharedData();

  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>([]);
  const router = useRouter();
  const { id } = router.query;
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setScreenshots(getScreenshotList() || []);
  }, [getScreenshotList]);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (screenshots.length >= 2) {
      const interval = setInterval(() => {
        setIsFading(true);
        setTimeout(() => {
          setCurrentIndex((prevIndex) => (prevIndex + 1) % screenshots.length);
          setIsFading(false);
        }, 800);
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [screenshots]);
  return (
    <InstanceWidgetBase
      title={t("InstanceWidgets.screenshots.title")}
      style={{ cursor: "pointer" }}
    >
      {screenshots && screenshots.length ? (
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
                pathname: `/games/instance/${id}/screenshots`,
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
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { getLocalModList } = useInstanceSharedData();

  const [localMods, setLocalMods] = useState<LocalModInfo[]>([]);

  useEffect(() => {
    setLocalMods(getLocalModList() || []);
  }, [getLocalModList]);

  const totalMods = localMods.length;
  const enabledMods = localMods.filter((mod) => mod.enabled).length;

  return (
    <InstanceWidgetBase
      title={t("InstanceWidgets.mods.title")}
      icon={LuSquareLibrary}
    >
      <VStack align="stretch" w="100%" spacing={3}>
        {localMods.length > 0 ? (
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
            router.push(`/games/instance/${id}/mods`);
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
  const { getWorldList } = useInstanceSharedData();
  const primaryColor = config.appearance.theme.primaryColor;

  const [localWorlds, setLocalWorlds] = useState<WorldInfo[]>([]);

  useEffect(() => {
    setLocalWorlds(getWorldList() || []);
  }, [getWorldList]);

  const lastPlayedWorld = localWorlds[0];

  return (
    <InstanceWidgetBase
      title={t("InstanceWidgets.lastPlayed.title")}
      icon={LuClock4}
    >
      {lastPlayedWorld ? (
        <>
          <OptionItem
            title={lastPlayedWorld.name}
            description={
              <VStack
                spacing={0}
                fontSize="xs"
                alignItems="flex-start"
                className="secondary-text"
              >
                <Text>
                  {formatRelativeTime(
                    UNIXToISOString(lastPlayedWorld.lastPlayedAt),
                    t
                  ).replace("on", "")}
                </Text>
                <Text>
                  {t(
                    `InstanceWorldsPage.worldList.gamemode.${lastPlayedWorld.gamemode}`
                  )}
                </Text>
                <Text>
                  {t(
                    `InstanceWorldsPage.worldList.difficulty.${lastPlayedWorld.difficulty}`
                  )}
                </Text>
              </VStack>
            }
            prefixElement={
              <Image
                src={convertFileSrc(lastPlayedWorld.iconSrc)}
                fallbackSrc="/images/icons/UnknownWorld.webp"
                alt={lastPlayedWorld.name}
                boxSize="28px"
                style={{ borderRadius: "4px" }}
              />
            }
          />
          <HStack spacing={1.5}>
            <Button
              size="xs"
              variant="ghost"
              colorScheme={primaryColor}
              position="absolute"
              left={2}
              bottom={2}
              justifyContent="flex-start"
            >
              <HStack spacing={1.5}>
                <Icon as={LuArrowRight} />
                <Text>{t("InstanceWidgets.lastPlayed.continuePlaying")}</Text>
              </HStack>
            </Button>
          </HStack>
        </>
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
              onClick={() => router.push(`/games/instance/${id}/${key}`)}
            >
              <VStack spacing={1} align="center">
                <Icon as={icon} boxSize="24px" />
                <Text fontSize="xs">
                  {t(`InstanceLayout.instanceTabList.${key}`)}
                </Text>
              </VStack>
            </Button>
          ) : (
            <Tooltip
              key={key}
              label={t(`InstanceLayout.instanceTabList.${key}`)}
            >
              <IconButton
                icon={<Icon as={icon} boxSize="32px" />}
                variant="ghost"
                size="lg"
                colorScheme={primaryColor}
                onClick={() => router.push(`/games/instance/${id}/${key}`)}
                aria-label={t(`InstanceLayout.instanceTabList.${key}`)}
              />
            </Tooltip>
          )
        )}
      </Grid>
    </InstanceWidgetBase>
  );
};

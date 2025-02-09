import {
  Avatar,
  AvatarGroup,
  BoxProps,
  Button,
  Center,
  Fade,
  Grid,
  GridItem,
  HStack,
  Icon,
  IconButton,
  Image,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import {
  LuArrowRight,
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
import { LocalModInfo, WorldInfo } from "@/models/game-instance";
import {
  mockLocalMods,
  mockScreenshots,
  mockWorlds,
} from "@/models/mock/game-instance";
import { formatRelativeTime } from "@/utils/datetime";

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
          color={`${primaryColor}.100`}
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
            {summary?.modLoader.type && (
              <Text>{`${summary.modLoader.type} ${summary?.modLoader.version}`}</Text>
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
          <Center boxSize={7} color={`${primaryColor}.600`}>
            <LuCalendarClock fontSize="24px" />
          </Center>
        }
      />
    </InstanceWidgetBase>
  );
};

export const InstanceScreenshotsWidget = () => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % mockScreenshots.length);
    }, 10000); // carousel (TODO: transition)
    return () => clearInterval(interval);
  }, []);

  return (
    <InstanceWidgetBase title={t("InstanceWidgets.screenshots.title")}>
      <Image
        src={mockScreenshots[currentIndex].imgSrc}
        alt={mockScreenshots[currentIndex].fileName}
        objectFit="cover"
        position="absolute"
        borderRadius="md"
        w="100%"
        h="100%"
        ml={-3}
        mt={-3}
      />
    </InstanceWidgetBase>
  );
};

export const InstanceModsWidget = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = router.query;
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [localMods, setLocalMods] = useState<LocalModInfo[]>([]);

  useEffect(() => {
    // only for mock
    setLocalMods(mockLocalMods);
  }, []);

  const totalMods = localMods.length;
  const enabledMods = localMods.filter((mod) => mod.enabled).length;

  return (
    <InstanceWidgetBase
      title={t("InstanceWidgets.mods.title")}
      icon={LuSquareLibrary}
    >
      <HStack spacing={4}>
        <VStack align="flex-start" spacing={3}>
          <AvatarGroup size="sm" max={5} spacing={-2.5}>
            {localMods.map((mod, index) => (
              <Avatar key={index} name={mod.name} src={mod.iconSrc} />
            ))}
          </AvatarGroup>
          <Text fontSize="xs" color="gray.500">
            {t("InstanceWidgets.mods.summary", { totalMods, enabledMods })}
          </Text>
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
      </HStack>
    </InstanceWidgetBase>
  );
};

export const InstanceLastPlayedWidget = () => {
  const { t } = useTranslation();
  const [localWorlds, setLocalWorlds] = useState<WorldInfo[]>([]);
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const router = useRouter();

  useEffect(() => {
    // only for mock
    setLocalWorlds(mockWorlds);
  }, []);

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
                  {formatRelativeTime(lastPlayedWorld.lastPlayedAt, t).replace(
                    "on",
                    ""
                  )}
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
                src={`/images/icons/GrassBlock.png`}
                alt={lastPlayedWorld.name}
                boxSize="28px"
                objectFit="cover"
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
  const { t, i18n } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const router = useRouter();
  const { id } = router.query;

  const features: Record<string, IconType> = {
    worlds: LuEarth,
    resourcepacks: LuPackage,
    shaderpacks: LuHaze,
    settings: LuSettings,
  };

  return (
    <InstanceWidgetBase title={t("InstanceWidgets.more.title")} icon={LuShapes}>
      <Grid templateColumns="repeat(3, 1fr)" rowGap={2}>
        {Object.entries(features).map(([key, icon]) =>
          i18n.language.startsWith("zh") ? (
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

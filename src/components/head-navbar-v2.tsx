import {
  Box,
  Divider,
  Flex,
  HStack,
  Icon,
  Text,
  Tooltip,
  useBreakpointValue,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import {
  LuBox,
  LuCircleUserRound,
  LuCompass,
  LuSearch,
  LuSettings,
  LuZap,
} from "react-icons/lu";
import AdvancedCard from "@/components/common/advanced-card";
import { DownloadIndicator } from "@/components/download-indicator";
import { TitleShort } from "@/components/logo-title";
import PlayerAvatar from "@/components/player-avatar";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useTaskContext } from "@/contexts/task";
import styles from "@/styles/head-navbar.module.css";

const HeadNavBar = () => {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { config } = useLauncherConfig();
  const { openSharedModal } = useSharedModals();
  const { tasks } = useTaskContext();

  const primaryColor = config.appearance.theme.primaryColor;
  const headNavStyle = config.appearance.theme.headNavStyle;
  const isCompactLayout =
    useBreakpointValue({ base: true, lg: false }) ?? false;
  const isSimplified =
    headNavStyle === "simplified" ||
    (headNavStyle === "adaptive" && isCompactLayout);
  const isDownloadIndicatorShown = tasks.length > 0;

  const [isAnimating, setIsAnimating] = useState(false);
  const [indicator, setIndicator] = useState({
    left: 0,
    width: 0,
    visible: false,
  });
  const navListRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // easy-launcher tokens (docs/design/DESIGN.md): light-only design, no dark variants.
  const unselectTabColor = "muted";
  const selectedTextColor = "accent";
  const indicatorBg = "ink";
  const indicatorBorder = "ink";
  const hoverBg = "var(--chakra-colors-surface, #CFE3D3)";

  const navList = useMemo<
    Array<{
      icon: IconType;
      label: string;
      path?: string;
      onClick?: () => void;
    }>
  >(() => {
    const discoverPageMode = config.general.functionality.discoverPage;

    return [
      { icon: LuZap, label: "launch", path: "/launch" },
      { icon: LuBox, label: "instances", path: "/instances" },
      { icon: LuCircleUserRound, label: "accounts", path: "/accounts" },
      ...(discoverPageMode === "on"
        ? [{ icon: LuCompass, label: "discover", path: "/discover" }]
        : discoverPageMode === "search-only"
          ? [
              {
                icon: LuSearch,
                label: "search",
                onClick: () => openSharedModal("spotlight-search"),
              },
            ]
          : []),
      { icon: LuSettings, label: "settings", path: "/settings" },
    ];
  }, [config.general.functionality.discoverPage, openSharedModal]);

  // animation trigger
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 700);
    return () => clearTimeout(timer);
  }, [
    config.appearance.theme.useLiquidGlassDesign,
    isDownloadIndicatorShown,
    isSimplified,
  ]);

  const selectedIndex = navList.findIndex(
    (item) => item.path && router.pathname.startsWith(item.path)
  );

  const updateIndicator = useCallback(() => {
    if (selectedIndex < 0) {
      setIndicator((prev) =>
        prev.visible ? { ...prev, visible: false } : prev
      );
      return;
    }

    const listEl = navListRef.current;
    const selectedEl = tabRefs.current[selectedIndex];
    if (!listEl || !selectedEl) {
      setIndicator((prev) =>
        prev.visible ? { ...prev, visible: false } : prev
      );
      return;
    }

    const listRect = listEl.getBoundingClientRect();
    const tabRect = selectedEl.getBoundingClientRect();
    const nextLeft = Math.round(tabRect.left - listRect.left);
    const nextWidth = Math.round(tabRect.width);

    setIndicator((prev) => {
      if (prev.visible && prev.left === nextLeft && prev.width === nextWidth) {
        return prev;
      }
      return {
        left: nextLeft,
        width: nextWidth,
        visible: true,
      };
    });
  }, [selectedIndex]);

  // indicator position update trigger
  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator, isSimplified, i18n.resolvedLanguage]);

  useEffect(() => {
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      updateIndicator();
    });
    if (navListRef.current) {
      observer.observe(navListRef.current);
    }
    tabRefs.current.forEach((el) => {
      if (el) {
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [updateIndicator, isSimplified, i18n.resolvedLanguage]);

  const handleTabChange = (index: number) => {
    const target = navList[index];
    if (target) {
      if (target.onClick) {
        target.onClick();
      } else if (target.path) {
        router.push(target.path);
      }
    }
  };

  return (
    <Flex
      justify="center"
      p={4} // easy-launcher pill nav (docs/design/DESIGN.md): ground pill, 2px ink border
    >
      <AdvancedCard
        level="back"
        pl={8}
        pr={isDownloadIndicatorShown ? 4 : 8}
        py={2}
        bg="ground"
        border="2px solid"
        borderColor="ink"
        borderRadius="999px"
        className={`animated-card ${isAnimating ? "animate" : ""}`}
      >
        <HStack spacing={4} h="100%">
          <TitleShort />
          <HStack
            ref={navListRef}
            role="tablist"
            className={styles.tabList}
            style={
              {
                "--head-nav-indicator-bg": indicatorBg,
                "--head-nav-indicator-border": indicatorBorder,
                "--head-nav-hover-bg": hoverBg,
              } as CSSProperties
            }
          >
            <Box
              className={`${styles.indicator} ${indicator.visible ? styles.indicatorVisible : ""}`}
              transform={`translateX(${indicator.left}px)`}
              w={`${indicator.width}px`}
            />
            {navList.map((item, index) => {
              const isSelected = selectedIndex === index;
              return (
                <Tooltip
                  key={`${item.label}-${item.path ?? "action"}`}
                  label={t(`HeadNavBar.navList.${item.label}`)}
                  placement="bottom"
                  isDisabled={!isSimplified || isSelected}
                >
                  <Box
                    as="button"
                    ref={(el: HTMLButtonElement | null) => {
                      tabRefs.current[index] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleTabChange(index)}
                    fontWeight={isSelected ? "600" : "normal"}
                    color={isSelected ? selectedTextColor : unselectTabColor}
                    className={styles.tabButton}
                  >
                    <HStack
                      id={`head-navbar-tab-${item.label}`}
                      className={styles.tabContent}
                    >
                      <Icon
                        as={item.icon}
                        boxSize={3.5}
                        className={styles.tabIcon}
                      />
                      {(!isSimplified || isSelected) && (
                        <Text fontSize="sm" lineHeight="1">
                          {t(`HeadNavBar.navList.${item.label}`)}
                        </Text>
                      )}
                    </HStack>
                  </Box>
                </Tooltip>
              );
            })}
          </HStack>
          {isDownloadIndicatorShown && (
            <>
              <Divider
                orientation="vertical"
                size="xl"
                h="100%"
                borderColor="var(--chakra-colors-chakra-placeholder-color)"
              />
              <DownloadIndicator />
            </>
          )}
          <AccountPill />
        </HStack>
      </AdvancedCard>
    </Flex>
  );
};

// easy-launcher account pill (docs/design/DESIGN.md): avatar disc + username.
const AccountPill = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { selectedPlayer } = useGlobalData();

  return (
    <HStack
      as="button"
      type="button"
      spacing={2.5}
      px={2}
      py={1}
      border="2px solid"
      borderColor="ink"
      borderRadius="999px"
      backgroundColor="transparent"
      _hover={{ backgroundColor: "surface" }}
      aria-label={t("HeadNavBar.navList.accounts")}
      onClick={() => router.push("/accounts")}
    >
      {selectedPlayer ? (
        <>
          <PlayerAvatar
            boxSize="28px"
            objectFit="cover"
            avatar={selectedPlayer.avatar}
          />
          <Text fontSize="sm" fontWeight="700" maxW="150px" isTruncated>
            {selectedPlayer.name}
          </Text>
        </>
      ) : (
        <>
          <HStack
            boxSize="28px"
            borderRadius="50%"
            backgroundColor="ink"
            color="accent"
            justify="center"
          >
            <Icon as={LuCircleUserRound} boxSize={4} aria-hidden />
          </HStack>
          <Text fontSize="sm" fontWeight="700">
            {t("HeadNavBar.navList.accounts")}
          </Text>
        </>
      )}
    </HStack>
  );
};

export default HeadNavBar;

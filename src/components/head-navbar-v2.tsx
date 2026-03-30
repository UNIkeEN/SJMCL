import {
  Box,
  Divider,
  Flex,
  HStack,
  Icon,
  Text,
  Tooltip,
  useColorModeValue,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import {
  LuBox,
  LuCircleUserRound,
  LuCompass,
  LuSettings,
  LuZap,
} from "react-icons/lu";
import AdvancedCard from "@/components/common/advanced-card";
import { DownloadIndicator } from "@/components/download-indicator";
import { TitleShort } from "@/components/logo-title";
import { useLauncherConfig } from "@/contexts/config";
import { useTaskContext } from "@/contexts/task";
import styles from "@/styles/head-navbar.module.css";

const NAV_LIST = [
  { icon: LuZap, label: "launch", path: "/launch" },
  { icon: LuBox, label: "instances", path: "/instances" },
  { icon: LuCircleUserRound, label: "accounts", path: "/accounts" },
  { icon: LuCompass, label: "discover", path: "/discover" },
  { icon: LuSettings, label: "settings", path: "/settings" },
] as const;

const HeadNavBar = () => {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { config } = useLauncherConfig();
  const { tasks } = useTaskContext();

  const primaryColor = config.appearance.theme.primaryColor;
  const isSimplified = config.appearance.theme.headNavStyle === "simplified";
  const isDownloadIndicatorShown = tasks.length > 0;

  const [isAnimating, setIsAnimating] = useState(false);
  const [indicator, setIndicator] = useState({
    left: 0,
    width: 0,
    visible: false,
  });
  const navListRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // tab color settings (we do not use chakra's Tab here because lack of dark style support and indicator animation)
  const unselectTabColor = useColorModeValue("gray.600", "gray.400");
  const selectedTextColor = useColorModeValue(
    `${primaryColor}.700`,
    `${primaryColor}.100`
  );
  const indicatorBg = useColorModeValue(
    `var(--chakra-colors-${primaryColor}-100)`,
    `var(--chakra-colors-${primaryColor}-700)`
  );
  const indicatorBorder = useColorModeValue(
    `var(--chakra-colors-${primaryColor}-200)`,
    `var(--chakra-colors-${primaryColor}-500)`
  );
  const hoverBg = useColorModeValue(
    `var(--chakra-colors-${primaryColor}-50)`,
    "rgba(255, 255, 255, 0.08)"
  );

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

  const selectedIndex = NAV_LIST.findIndex((item) =>
    router.pathname.startsWith(item.path)
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
    const target = NAV_LIST[index];
    if (target) {
      router.push(target.path);
    }
  };

  return (
    <Flex justify="center" p={4}>
      <AdvancedCard
        level="back"
        pl={8}
        pr={isDownloadIndicatorShown ? 4 : 8}
        py={2}
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
            {NAV_LIST.map((item, index) => {
              const isSelected = selectedIndex === index;
              return (
                <Tooltip
                  key={item.path}
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
        </HStack>
      </AdvancedCard>
    </Flex>
  );
};

export default HeadNavBar;

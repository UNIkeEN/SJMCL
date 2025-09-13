import {
  Box,
  Divider,
  Flex,
  HStack,
  Icon,
  IconButton,
  Tab,
  TabList,
  Tabs,
  Text,
  Tooltip,
  useColorModeValue,
} from "@chakra-ui/react";
import { Window, getCurrentWindow } from "@tauri-apps/api/window";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuBox,
  LuCircleUserRound,
  LuCompass,
  LuMaximize2,
  LuMinimize2,
  LuMinus,
  LuSearch,
  LuSettings,
  LuX,
  LuZap,
} from "react-icons/lu";
import {
  VscChromeClose,
  VscChromeMaximize,
  VscChromeMinimize,
  VscChromeRestore,
} from "react-icons/vsc";
import AdvancedCard from "@/components/common/advanced-card";
import { DownloadIndicator } from "@/components/download-indicator";
import { Logo, TitleFullWithLogo } from "@/components/logo-title";
import { useLauncherConfig } from "@/contexts/config";
import { useSharedModals } from "@/contexts/shared-modal";
import { useTaskContext } from "@/contexts/task";

const HeadNavBar = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const isMacOS = config.basicInfo.platform === "macos";
  const primaryColor = config.appearance.theme.primaryColor;
  const isSimplified = config.appearance.theme.headNavStyle === "simplified";

  const [appWindow, setAppWindow] = useState<Window | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const draggableAreaRef = useRef<HTMLDivElement>(null);

  const { openSharedModal } = useSharedModals();
  const { tasks } = useTaskContext();
  const isDownloadIndicatorShown = tasks.length > 0;

  const unselectTabColor = useColorModeValue("gray.600", "gray.400");

  const navList = [
    { icon: LuZap, label: "launch", path: "/launch" },
    { icon: LuBox, label: "instances", path: "/instances" },
    { icon: LuCircleUserRound, label: "accounts", path: "/accounts" },
    ...(config.general.functionality.discoverPage
      ? [{ icon: LuCompass, label: "discover", path: "/discover" }]
      : [
          {
            icon: LuSearch,
            label: "search",
            path: "%not-page",
            onNav: () => {
              openSharedModal("spotlight-search");
            },
          },
        ]),
    { icon: LuSettings, label: "settings", path: "/settings" },
  ];

  const selectedIndex = navList.findIndex((item) =>
    router.pathname.startsWith(item.path)
  );

  const handleTabChange = (index: number) => {
    const target = navList[index];
    target.path === "%not-page" ? target.onNav?.() : router.push(target.path);
  };

  const controlList = isMacOS
    ? [
        {
          icon: LuX,
          label: "close",
          color: "red.500",
          onClick: () => appWindow?.close(),
        },
        {
          icon: LuMinus,
          label: "minimize",
          color: "yellow.500",
          onClick: () => appWindow?.minimize(),
        },
        {
          icon: isMaximized ? LuMinimize2 : LuMaximize2,
          label: "maximize",
          color: "green.500",
          onClick: () => appWindow?.toggleMaximize(),
        },
      ]
    : [
        {
          icon: VscChromeMinimize,
          label: "minimize",
          onClick: () => appWindow?.minimize(),
        },
        {
          icon: isMaximized ? VscChromeRestore : VscChromeMaximize,
          label: "maximize",
          onClick: () => appWindow?.toggleMaximize(),
        },
        {
          color: "red.500",
          icon: VscChromeClose,
          label: "close",
          onClick: () => appWindow?.close(),
        },
      ];

  useEffect(() => {
    setAppWindow(getCurrentWindow());
  }, []);

  useEffect(() => {
    const draggableArea = draggableAreaRef.current;
    if (draggableArea && appWindow) {
      const handleMouseDown = (e: MouseEvent) => {
        // Check if the clicked element is an IconButton or its child
        const target = e.target as HTMLElement;
        const isIconButton =
          target.closest('[role="button"]') !== null ||
          target.closest("button") !== null ||
          target.tagName === "BUTTON";

        if (e.button === 0 && !isIconButton) {
          if (e.detail === 2) {
            appWindow.toggleMaximize(); // Maximize on double click
          } else {
            appWindow.startDragging();
          }
        }
      };
      draggableArea.addEventListener("mousedown", handleMouseDown);

      return () => {
        draggableArea.removeEventListener("mousedown", handleMouseDown);
      };
    }
  }, [appWindow, config.appearance.theme.useLiquidGlassDesign]);

  useEffect(() => {
    if (appWindow) {
      appWindow.isFocused().then(setIsFocused);
      const unlistenFocus = appWindow.onFocusChanged(({ payload: focused }) =>
        setIsFocused(focused)
      );
      return () => {
        unlistenFocus.then((fn) => fn());
      };
    }
  }, [appWindow]);

  useEffect(() => {
    let isMounted = true;
    if (appWindow) {
      appWindow.isMaximized().then((maximized) => {
        if (isMounted) setIsMaximized(maximized);
      });
      const unlisten = appWindow.onResized(async () => {
        const maximized = await appWindow.isMaximized();
        if (isMounted) setIsMaximized(maximized);
      });
      return () => {
        isMounted = false;
        unlisten.then((fn) => fn());
      };
    }
  }, [appWindow]);

  return (
    <AdvancedCard
      ref={draggableAreaRef}
      level="back"
      px={0}
      py={2}
      noRadius
      zIndex="calc(var(--chakra-zIndices-modal) + 1)"
    >
      <Flex
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        h="100%"
      >
        {isMacOS ? (
          <HStack spacing="1.5" pl="4">
            {controlList.map((item) => (
              <IconButton
                variant="solid"
                borderRadius="full"
                size=""
                padding="1"
                bgColor={isFocused ? item.color : "gray.500"}
                color="transparent"
                key={item.label}
                icon={<item.icon size={7} />}
                aria-label={item.label}
                onClick={item.onClick}
                _hover={{ color: "black" }}
                _active={{ background: item.color }}
              />
            ))}
          </HStack>
        ) : (
          <Box pl="4">
            <TitleFullWithLogo />
          </Box>
        )}
        <HStack spacing={4} height="100%">
          <Tabs
            variant="soft-rounded"
            size="sm"
            colorScheme={primaryColor}
            index={selectedIndex}
            onChange={handleTabChange}
          >
            <TabList>
              {navList.map((item, index) => (
                <Tooltip
                  key={item.path}
                  label={t(`HeadNavBar.navList.${item.label}`)}
                  placement="bottom"
                  isDisabled={!isSimplified || selectedIndex === index}
                >
                  <Tab
                    fontWeight={selectedIndex === index ? "600" : "normal"}
                    color={
                      selectedIndex === index ? "inherit" : unselectTabColor
                    }
                  >
                    <HStack spacing={2} id={`head-navbar-tab-${item.label}`}>
                      <Icon as={item.icon} />
                      {(!isSimplified || selectedIndex === index) && (
                        <Text>{t(`HeadNavBar.navList.${item.label}`)}</Text>
                      )}
                    </HStack>
                  </Tab>
                </Tooltip>
              ))}
            </TabList>
          </Tabs>
          {isDownloadIndicatorShown && (
            <>
              <Divider
                orientation="vertical"
                size="xl"
                h="80%"
                borderColor="var(--chakra-colors-chakra-placeholder-color)"
              />
              <DownloadIndicator />
            </>
          )}
        </HStack>
        {isMacOS ? (
          <Logo mr="4" />
        ) : (
          <HStack spacing="1" pr="2">
            {controlList.map((item) => (
              <IconButton
                variant="ghost"
                key={item.label}
                icon={<item.icon />}
                aria-label={item.label}
                onClick={item.onClick}
                _hover={
                  item.color
                    ? { background: item.color, color: "white" }
                    : {
                        color: "var(--chakra-colors-chakra-placeholder-color)",
                      }
                }
              />
            ))}
          </HStack>
        )}
      </Flex>
    </AdvancedCard>
  );
};

export default HeadNavBar;

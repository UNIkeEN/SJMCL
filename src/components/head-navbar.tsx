import {
  Divider,
  Flex,
  HStack,
  Icon,
  Tab,
  TabList,
  Tabs,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { useLauncherConfig } from "@/contexts/config";
import { useSharedModals } from "@/contexts/shared-modal";
import { useTaskContext } from "@/contexts/task";
import { useThemedCSSStyle } from "@/hooks/themed-css";

const HeadNavBar = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const isSimplified = config.appearance.theme.headNavStyle === "simplified";
  const themedStyles = useThemedCSSStyle();
  const { openSharedModal } = useSharedModals();
  const [isAnimating, setIsAnimating] = useState(false);
  const { tasks } = useTaskContext();
  const isDownloadIndicatorShown = tasks.length > 0;

  useEffect(() => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 700);
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    config.appearance.theme.useLiquidGlassDesign,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    isDownloadIndicatorShown,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    isSimplified,
  ]);

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
                  <Tab fontWeight={selectedIndex === index ? "600" : "normal"}>
                    <HStack spacing={2}>
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

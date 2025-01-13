import {
  Card,
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
import { useTranslation } from "react-i18next";
import {
  LuBox,
  LuCircleUserRound,
  LuCompass,
  LuSettings,
  LuZap,
} from "react-icons/lu";
import { TitleShort } from "@/components/logo-title";
import { useLauncherConfig } from "@/contexts/config";

const HeadNavBar = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const isSimplified = config.appearance.theme.headNavStyle === "simplified";

  const navList = [
    { icon: LuZap, label: "launch", path: "/launch" },
    { icon: LuBox, label: "games", path: "/games" },
    { icon: LuCircleUserRound, label: "accounts", path: "/accounts" },
    ...(config.general.optionalFunctions.discover
      ? [{ icon: LuCompass, label: "discover", path: "/discover" }]
      : []),
    { icon: LuSettings, label: "settings", path: "/settings" },
  ];

  const selectedIndex = navList.findIndex((item) =>
    router.pathname.startsWith(item.path)
  );

  return (
    <Flex justify="center" p={4}>
      <Card className="content-blur-bg" px={8} py={2}>
        <HStack spacing={4}>
          <TitleShort />
          <Tabs
            variant="soft-rounded"
            size="sm"
            colorScheme={primaryColor}
            index={selectedIndex}
            onChange={(index) => {
              router.push(navList[index].path);
            }}
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
        </HStack>
      </Card>
    </Flex>
  );
};

export default HeadNavBar;

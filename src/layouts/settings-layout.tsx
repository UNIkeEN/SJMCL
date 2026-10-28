import { Badge, Box, Flex, Icon, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import {
  LuCircleHelp,
  LuCloudDownload,
  LuCoffee,
  LuGamepad2,
  LuGrid2X2Plus,
  LuInfo,
  LuPalette,
  LuSettings,
} from "react-icons/lu";
import NavMenu from "@/components/common/nav-menu";
import { useLauncherConfig } from "@/contexts/config";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

const SettingsLayout: React.FC<SettingsLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { newerVersion } = useLauncherConfig();

  const settingsDomainList: { key: string; icon: IconType }[][] = [
    [
      { key: "global-game", icon: LuGamepad2 },
      { key: "java", icon: LuCoffee },
    ],
    [
      { key: "general", icon: LuSettings },
      { key: "appearance", icon: LuPalette },
      { key: "download", icon: LuCloudDownload },
      { key: "extension", icon: LuGrid2X2Plus },
      { key: "help", icon: LuCircleHelp },
      { key: "about", icon: LuInfo },
    ],
  ];

  const settingsPaths = settingsDomainList
    .flat()
    .map((item) => `/settings/${item.key}`);
  const selectedKey =
    settingsPaths.find((path) => router.pathname.startsWith(path)) || "";

  return (
    <Flex gap={5} h="100%" align="flex-start">
      {/* easy-launcher sidebar (docs/design/DESIGN.md): ground card, ink border, hard shadow */}
      <Flex
        direction="column"
        as="nav"
        w="220px"
        flexShrink={0}
        className="content-full-y"
        backgroundColor="ground"
        border="2px solid"
        borderColor="ink"
        borderRadius="el-lg"
        boxShadow="shadow-hard"
        p={3}
        overflowY="auto"
      >
        {settingsDomainList.map((group, index) => (
          <Box key={index} mb={index < settingsDomainList.length - 1 ? 5 : 0}>
            <NavMenu
              selectedKeys={[selectedKey]}
              onClick={(value) => router.push(value)}
              items={group.map((item) => ({
                label: (
                  <Box
                    as="span"
                    display="flex"
                    alignItems="center"
                    gap={2}
                    w="100%"
                    overflow="hidden"
                  >
                    <Icon as={item.icon} flexShrink={0} />
                    <Text fontSize="sm" className="ellipsis-text">
                      {t(`SettingsLayout.settingsDomainList.${item.key}`)}
                    </Text>
                    {item.key === "about" && newerVersion.version && (
                      <Badge
                        bg="accent"
                        color="ink"
                        borderRadius="el-pill"
                        ml="auto"
                        flexShrink={0}
                      >
                        {t("General.new")}
                      </Badge>
                    )}
                  </Box>
                ),
                value: `/settings/${item.key}`,
                tooltip: t(`SettingsLayout.settingsDomainList.${item.key}`),
              }))}
            />
          </Box>
        ))}
      </Flex>
      <Box flex={1} minW={0} className="content-full-y" key={router.asPath}>
        {children}
      </Box>
    </Flex>
  );
};

export default SettingsLayout;

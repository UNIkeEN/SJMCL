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
    <Flex h="100%" align="stretch">
      {/* easy-launcher settings sidebar (docs/design/DESIGN-settings.md):
          240px column separated from content by a 1px line, monochrome tabs */}
      <Flex
        direction="column"
        as="nav"
        w="240px"
        flexShrink={0}
        className="content-full-y"
        borderRight="1px solid"
        borderColor="line"
        p={3}
        pt={4}
        overflowY="auto"
      >
        {settingsDomainList.map((group, index) => (
          <Box key={index} mb={index < settingsDomainList.length - 1 ? 3 : 0}>
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
                        bg="ink"
                        color="onInk"
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

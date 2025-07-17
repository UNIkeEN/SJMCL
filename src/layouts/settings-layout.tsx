import { Grid, GridItem, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import {
  LuCircleHelp,
  LuCloudDownload,
  LuCoffee,
  LuFlaskConical,
  LuGamepad2,
  LuInfo,
  LuPalette,
  LuRefreshCcw,
  LuSettings,
} from "react-icons/lu";
import NavMenu from "@/components/common/nav-menu";
import { isDev } from "@/utils/env";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

const SettingsLayout: React.FC<SettingsLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { t } = useTranslation();

  const settingsDomainList: { key: string; icon: IconType }[][] = [
    [
      { key: "global-game", icon: LuGamepad2 },
      { key: "java", icon: LuCoffee },
    ],
    [
      { key: "general", icon: LuSettings },
      { key: "appearance", icon: LuPalette },
      { key: "download", icon: LuCloudDownload },
      { key: "sync-restore", icon: LuRefreshCcw },
      { key: "help", icon: LuCircleHelp },
      { key: "about", icon: LuInfo },
    ],
    ...(isDev ? [[{ key: "dev-test", icon: LuFlaskConical }]] : []),
  ];

  return (
    <Grid templateColumns="1fr 3fr" gap={4} h="100%">
      <GridItem className="content-full-y">
        <VStack align="stretch" spacing={4}>
          {settingsDomainList.map((group, index) => (
            <NavMenu
              key={index}
              selectedKeys={[router.asPath]}
              onClick={(value) => {
                router.push(value);
              }}
              items={group.map((item) => ({
                label: (
                  <HStack spacing={2} overflow="hidden">
                    <Icon as={item.icon} />
                    <Text fontSize="sm" className="ellipsis-text">
                      {t(`SettingsLayout.settingsDomainList.${item.key}`)}
                    </Text>
                  </HStack>
                ),
                value: `/settings/${item.key}`,
              }))}
            />
          ))}
        </VStack>
      </GridItem>
      <GridItem className="content-full-y" key={router.asPath}>
        <VStack align="stretch" spacing={4}>
          {children}
        </VStack>
      </GridItem>
    </Grid>
  );
};

export default SettingsLayout;

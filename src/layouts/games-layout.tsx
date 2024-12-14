import {
  Box,
  Grid,
  GridItem,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import { LuBox, LuBoxes, LuCirclePlus, LuSettings } from "react-icons/lu";
import NavMenu from "@/components/common/nav-menu";
import SelectableButton from "@/components/common/selectable-button";
import { useData } from "@/contexts/data";
import InstanceLayout from "@/layouts/instance-layout";

interface GamesLayoutProps {
  children: React.ReactNode;
}

const GamesLayout: React.FC<GamesLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { gameInstanceSummaryList } = useData();

  const gameInstanceList: { key: string; icon: IconType; label: string }[] = [
    { key: "all", icon: LuBoxes, label: t("AllGamesPage.title") },
    ...gameInstanceSummaryList.map((item) => ({
      key: `instance/${item.id}`,
      icon: LuBox,
      label: item.name,
    })),
  ];

  // Check if the route is for a specific game instance
  const isInstanceRoute = router.asPath.startsWith("/games/instance/");

  return (
    <Grid templateColumns="1fr 3fr" gap={4} h="100%">
      <GridItem className="content-full-y">
        <VStack align="stretch" h="100%" spacing={4}>
          <Box flex="1" overflowY="auto">
            <NavMenu
              selectedKeys={[router.asPath]}
              onClick={(value) => {
                router.push(value);
              }}
              items={gameInstanceList.map((item) => ({
                label: (
                  <HStack spacing={2} overflow="hidden">
                    <Icon as={item.icon} />
                    <Text fontSize="sm" className="ellipsis-text">
                      {item.label}
                    </Text>
                  </HStack>
                ),
                value: `/games/${item.key}`,
                tooltip: item.key === "all" ? "" : item.label,
              }))}
            />
          </Box>
          <VStack mt="auto" align="strench" spacing={0.5}>
            <SelectableButton size="sm">
              <HStack spacing={2}>
                <Icon as={LuCirclePlus} />
                <Text fontSize="sm">
                  {t("AllGamesPage.Button.addAndImport")}
                </Text>
              </HStack>
            </SelectableButton>
            <SelectableButton
              size="sm"
              onClick={() => {
                router.push("/settings/global-game");
              }}
            >
              <HStack spacing={2}>
                <Icon as={LuSettings} />
                <Text fontSize="sm">
                  {t("SettingsLayout.settingsDomainList.global-game")}
                </Text>
              </HStack>
            </SelectableButton>
          </VStack>
        </VStack>
      </GridItem>
      <GridItem className="content-full-y">
        {isInstanceRoute ? (
          <InstanceLayout>{children}</InstanceLayout>
        ) : (
          children // Render the default children
        )}
      </GridItem>
    </Grid>
  );
};

export default GamesLayout;

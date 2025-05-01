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
import { FaStar } from "react-icons/fa6";
import {
  LuBox,
  LuBoxes,
  LuCirclePlus,
  LuFolder,
  LuSettings,
} from "react-icons/lu";
import NavMenu from "@/components/common/nav-menu";
import SelectableButton from "@/components/common/selectable-button";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { getGameDirName } from "@/utils/instance";

interface InstancesLayoutProps {
  children: React.ReactNode;
}

const InstancesLayout: React.FC<InstancesLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { getInstanceList } = useGlobalData();
  const instanceList = getInstanceList() || [];
  const { config } = useLauncherConfig();
  const navBarType = config.general.functionality.instancesNavType;
  const showNavBar = navBarType !== "hidden";

  const instanceItems: { key: string; icon: IconType; label: string }[] = [
    { key: "all", icon: LuBoxes, label: t("AllInstancesPage.title") },
    ...(navBarType === "instance"
      ? instanceList.map((item) => ({
          // group by instance
          key: `details/${item.id}`,
          icon: item.starred ? FaStar : LuBox,
          label: item.name,
        }))
      : config.localGameDirectories.map((item) => ({
          key: `all?dir=${item.name}`,
          icon: LuFolder,
          label: getGameDirName(item),
        }))),
  ];

  // Truncate to the ID, excluding subpage routes
  const prefixAsPathPart = router.asPath.split("/").slice(0, 4).join("/");

  const isInstancePage = (path: String) =>
    path.startsWith("/instances/details/");

  return (
    <Grid templateColumns={showNavBar ? "1fr 3fr" : "3fr"} gap={4} h="100%">
      {showNavBar && (
        <GridItem className="content-full-y">
          <VStack align="stretch" h="100%" spacing={4}>
            <Box flex="1" overflowY="auto">
              <NavMenu
                selectedKeys={[prefixAsPathPart]}
                onClick={(value) => {
                  if (isInstancePage(router.asPath) && isInstancePage(value)) {
                    router.push(
                      // across instances, not change subpath
                      `${value}${router.asPath.replace(prefixAsPathPart, "")}`
                    );
                  } else router.push(value);
                }}
                items={instanceItems.map((item) => ({
                  label: (
                    <HStack spacing={2} overflow="hidden">
                      <Icon as={item.icon} />
                      <Text fontSize="sm" className="ellipsis-text">
                        {item.label}
                      </Text>
                    </HStack>
                  ),
                  value: `/instances/${item.key}`,
                  tooltip: item.key === "all" ? "" : item.label,
                }))}
              />
            </Box>
            <VStack mt="auto" align="strench" spacing={0.5}>
              <SelectableButton
                size="sm"
                onClick={() => {
                  router.push("/instances/add-import");
                }}
                isSelected={router.asPath === "/instances/add-import"}
              >
                <HStack spacing={2}>
                  <Icon as={LuCirclePlus} />
                  <Text fontSize="sm">
                    {t("AllInstancesPage.button.addAndImport")}
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
      )}
      <GridItem className="content-full-y">{children}</GridItem>
    </Grid>
  );
};

export default InstancesLayout;

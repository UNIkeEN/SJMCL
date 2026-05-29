import {
  Box,
  Center,
  CircularProgress,
  CircularProgressLabel,
  Grid,
  GridItem,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FaPause, FaPlay, FaStar } from "react-icons/fa6";
import { GoDotFill } from "react-icons/go";
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
import { parseTaskGroup, useTaskContext } from "@/contexts/task";
import { ChakraColorEnums } from "@/enums/misc";
import { GTaskEventStatusEnums, TaskGroupDesc } from "@/models/task";
import { getGameDirName } from "@/utils/instance";

interface InstancesLayoutProps {
  children: React.ReactNode;
}

const InstancesLayout: React.FC<InstancesLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { getInstanceList } = useGlobalData();
  const instanceList = useMemo(
    () => getInstanceList() || [],
    [getInstanceList]
  );
  const { config } = useLauncherConfig();
  const navBarType = config.general.functionality.instancesNavType;
  const showNavBar = navBarType !== "hidden";

  const { tasks } = useTaskContext();

  const installTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status === GTaskEventStatusEnums.Cancelled) return false;
      const parsed = parseTaskGroup(t.taskGroup);
      return (
        parsed.name === "game-client" || parsed.name === "game-client-w-java"
      );
    });
  }, [tasks]);

  const instanceItems: {
    value: string;
    icon: React.ReactNode;
    label: string;
    tooltip?: string;
    rightElement?: React.ReactNode;
  }[] = useMemo(
    () => [
      {
        value: "/instances/list",
        icon: <Icon as={LuBoxes} />,
        label: t("AllInstancesPage.title"),
        tooltip: "",
      },
      ...(navBarType === "instance"
        ? installTasks
            .filter(
              (t) =>
                t.status === GTaskEventStatusEnums.Started ||
                t.status === GTaskEventStatusEnums.Stopped
            )
            .map((t) => {
              const parsed = parseTaskGroup(t.taskGroup);
              const name =
                parsed.params.param || parsed.params.param1 || t.taskGroup;
              return {
                value: "/downloads",
                icon: <Icon as={LuBox} />,
                label: name,
                tooltip: name,
                rightElement: <InstanceDownloadIndicator task={t} />,
              };
            })
        : []),
      ...(navBarType === "instance"
        ? instanceList.map((item) => ({
            // group by instance
            value: item.id,
            icon: <Icon as={item.starred ? FaStar : LuBox} />,
            label: item.name,
          }))
        : navBarType === "tag"
          ? ChakraColorEnums.map((color) => ({
              // group by color tag
              value: `/instances/list?tag=${encodeURIComponent(color)}`,
              icon: <Icon as={GoDotFill} color={`${color}.500`} />,
              label: t(`Enums.chakraColors.${color}`),
            }))
          : config.localGameDirectories.map((item) => ({
              value: `/instances/list?dir=${encodeURIComponent(item.name)}`,
              icon: <Icon as={LuFolder} />,
              label: getGameDirName(item),
            }))),
    ],
    [config.localGameDirectories, instanceList, installTasks, navBarType, t]
  );

  // Truncate to the ID, excluding subpage routes
  const isInstanceDetailsPage = (path: string) =>
    path.startsWith("/instances/details/");

  const selectedKey = useMemo(() => {
    const parts = router.asPath.split("/");
    if (parts[2] === "details" && parts[3]) {
      return decodeURIComponent(parts[3]);
    }
    return router.asPath;
  }, [router.asPath]);

  return (
    <Grid templateColumns={showNavBar ? "1fr 3fr" : "3fr"} gap={4} h="100%">
      {showNavBar && (
        <GridItem className="content-full-y">
          <VStack align="stretch" h="100%" spacing={4}>
            <Box flex="1" overflowY="auto">
              <NavMenu
                selectedKeys={[selectedKey]}
                onClick={(value) => {
                  const detailsRoute = {
                    pathname: "/instances/details/[id]",
                    query: { id: value },
                  };
                  if (
                    isInstanceDetailsPage(router.asPath) &&
                    typeof value === "string" &&
                    !value.startsWith("/instances/")
                  ) {
                    // Across instances, keep the current detail tab (preserves the first child segment only, e.g. "settings", rather than a deeper nested path like "settings/advanced")
                    router.push({
                      pathname:
                        router.pathname === "/instances/details/[id]"
                          ? "/instances/details/[id]"
                          : `/instances/details/[id]/${router.pathname.split("/")[4] ?? "overview"}`,
                      query: { id: value },
                    });
                  } else {
                    router.push(
                      typeof value === "string" &&
                        value.startsWith("/instances/")
                        ? value
                        : detailsRoute
                    );
                  }
                }}
                items={instanceItems.map((item) => ({
                  label: (
                    <HStack spacing={2} overflow="hidden" w="100%">
                      {item.icon}
                      <Text fontSize="sm" className="ellipsis-text" flex="1">
                        {item.label}
                      </Text>
                      {item.rightElement && (
                        <Box flexShrink={0}>{item.rightElement}</Box>
                      )}
                    </HStack>
                  ),
                  value: item.value,
                  tooltip: item.tooltip ?? item.label,
                }))}
              />
            </Box>
            <VStack mt="auto" align="stretch" spacing={0.5}>
              <SelectableButton
                size="sm"
                onClick={() => {
                  router.push("/instances/add-import");
                }}
                isSelected={router.asPath === "/instances/add-import"}
              >
                <HStack spacing={2} overflow="hidden">
                  <Icon as={LuCirclePlus} />
                  <Text fontSize="sm" className="ellipsis-text">
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
                <HStack spacing={2} overflow="hidden">
                  <Icon as={LuSettings} />
                  <Text fontSize="sm" className="ellipsis-text">
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

const InstanceDownloadIndicator: React.FC<{ task: TaskGroupDesc }> = ({
  task,
}) => {
  const { handleStopProgressiveTaskGroup, handleResumeProgressiveTaskGroup } =
    useTaskContext();
  const isStarted = task.status === GTaskEventStatusEnums.Started;

  return (
    <Box
      onClick={(e) => {
        e.stopPropagation();
        if (isStarted) handleStopProgressiveTaskGroup(task.taskGroup);
        else handleResumeProgressiveTaskGroup(task.taskGroup);
      }}
      cursor="pointer"
      borderRadius="full"
      display="flex"
      alignItems="center"
    >
      <CircularProgress
        size="20px"
        value={task.progress ?? 0}
        thickness={8}
        trackColor="transparent"
      >
        <CircularProgressLabel>
          <Center w="100%" h="100%">
            <Icon as={isStarted ? FaPause : FaPlay} boxSize={2.5} />
          </Center>
        </CircularProgressLabel>
      </CircularProgress>
    </Box>
  );
};

export default InstancesLayout;

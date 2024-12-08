import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuLayoutGrid, LuLayoutList, LuPlay, LuPlus } from "react-icons/lu";
import SegmentedControl from "@/components/common/segmented";
import GamesGridView from "@/components/games-grid-view";
import GamesListView from "@/components/games-list-view";
import { useLauncherConfig } from "@/contexts/config";
import { useData, useDataDispatch } from "@/contexts/data";
import {
  GameInstanceSummary,
  mockGameInstanceSummaryList,
} from "@/models/game-instance";

const AllGames = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [selectedView, setSelectedView] = useState<string>("list");
  const { selectedGameInstance, gameInstanceSummaryList } = useData();
  const { setSelectedGameInstance, setGameInstanceSummaryList } =
    useDataDispatch();

  // useEffect(() => {
  //   // TBD: only use mock data now
  //   setGameInstanceSummaryList(mockGameInstanceSummaryList);
  // }, []);

  const viewTypeList = [
    {
      key: "grid",
      icon: LuLayoutGrid,
      tooltip: t("GamesPage.viewTypeList.grid"),
    },
    {
      key: "list",
      icon: LuLayoutList,
      tooltip: t("GamesPage.viewTypeList.list"),
    },
  ];
  return (
    <Box display="flex" flexDirection="column" height="100%">
      <Flex alignItems="flex-start" flexShrink={0}>
        <VStack spacing={0} align="start">
          <Text fontWeight="bold" fontSize="sm" className="no-select">
            {t("GamesLayout.gamesDomainList.all")}
          </Text>
        </VStack>
        <HStack spacing={2} ml="auto" alignItems="flex-start">
          <SegmentedControl
            selected={selectedView}
            onSelectItem={(s) => {
              setSelectedView(s);
            }}
            size="2xs"
            items={viewTypeList.map((item) => ({
              ...item,
              label: item.key,
              value: <Icon as={item.icon} />,
            }))}
            withTooltip={true}
          />
          <Button
            leftIcon={<LuPlus />}
            size="xs"
            colorScheme={primaryColor}
            variant={primaryColor === "gray" ? "subtle" : "outline"}
            onClick={() => {}} // todo
          >
            {t("GamesPage.Button.addAndImport")}
          </Button>
          <Button
            leftIcon={<LuPlay />}
            size="xs"
            colorScheme={primaryColor}
            isDisabled={!selectedGameInstance}
            onClick={() => {}} // todo
          >
            {t("GamesPage.Button.launch")}
          </Button>
        </HStack>
      </Flex>
      <Box overflow="auto" flexGrow={1} mt={2.5}>
        {selectedView === "grid" && (
          <GamesGridView
            games={gameInstanceSummaryList}
            selectedGame={selectedGameInstance}
            setSelectedGame={setSelectedGameInstance}
          />
        )}
        {selectedView === "list" && (
          <GamesListView
            games={gameInstanceSummaryList}
            selectedGame={selectedGameInstance}
            setSelectedGame={setSelectedGameInstance}
          />
        )}
      </Box>
    </Box>
  );
};

export default AllGames;

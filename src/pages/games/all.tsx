import { Box, Button, HStack, Icon } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuLayoutGrid, LuLayoutList, LuPlay, LuPlus } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { Section } from "@/components/common/section";
import SegmentedControl from "@/components/common/segmented";
import GamesView from "@/components/games-view";
import { useLauncherConfig } from "@/contexts/config";
import { useData } from "@/contexts/data";
import { useSharedModals } from "@/contexts/shared-modal";
import { GameInstanceSummary } from "@/models/instance/misc";

const AllGamesPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const selectedViewType = config.states.allGamesPage.viewType;
  const { openSharedModal } = useSharedModals();

  const { selectedGameInstance, getGameInstanceList } = useData();
  const [gameInstanceList, setGameInstanceList] = useState<
    GameInstanceSummary[]
  >([]);

  useEffect(() => {
    setGameInstanceList(getGameInstanceList() || []);
  }, [getGameInstanceList]);

  const viewTypeList = [
    {
      key: "grid",
      icon: LuLayoutGrid,
      tooltip: t("AllGamesPage.viewTypeList.grid"),
    },
    {
      key: "list",
      icon: LuLayoutList,
      tooltip: t("AllGamesPage.viewTypeList.list"),
    },
  ];

  return (
    <Section
      display="flex"
      flexDirection="column"
      height="100%"
      title={t("AllGamesPage.title")}
      headExtra={
        <HStack spacing={2}>
          <CommonIconButton
            icon="refresh"
            size="xs"
            fontSize="sm"
            onClick={() => {
              setGameInstanceList(getGameInstanceList(true) || []);
            }}
          />
          <SegmentedControl
            selected={selectedViewType}
            onSelectItem={(s) => {
              update("states.allGamesPage.viewType", s as string);
            }}
            size="2xs"
            ml={1}
            items={viewTypeList.map((item) => ({
              ...item,
              value: item.key,
              label: <Icon as={item.icon} />,
            }))}
            withTooltip
          />
          <Button
            leftIcon={<LuPlus />}
            size="xs"
            colorScheme={primaryColor}
            variant={primaryColor === "gray" ? "subtle" : "outline"}
            onClick={() => {
              router.push("/games/add-import");
            }}
          >
            {t("AllGamesPage.button.addAndImport")}
          </Button>
          <Button
            leftIcon={<LuPlay />}
            size="xs"
            colorScheme={primaryColor}
            isDisabled={!selectedGameInstance}
            onClick={() => {
              if (selectedGameInstance) {
                openSharedModal("launch", {
                  instanceId: selectedGameInstance.id,
                });
              }
            }}
          >
            {t("AllGamesPage.button.launch")}
          </Button>
        </HStack>
      }
    >
      <Box overflow="auto" flexGrow={1} rounded="md">
        <GamesView games={gameInstanceList} viewType={selectedViewType} />
      </Box>
    </Section>
  );
};

export default AllGamesPage;

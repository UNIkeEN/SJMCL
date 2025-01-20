import { Box, Button, HStack, Icon } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { LuLayoutGrid, LuLayoutList, LuPlay, LuPlus } from "react-icons/lu";
import { Section } from "@/components/common/section";
import SegmentedControl from "@/components/common/segmented";
import GamesView from "@/components/games-view";
import { useLauncherConfig } from "@/contexts/config";
import { useData } from "@/contexts/data";

const AllGamesPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const selectedViewType = config.page.games.viewType;

  const { selectedGameInstance, gameInstanceSummaryList } = useData();

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
          <SegmentedControl
            selected={selectedViewType}
            onSelectItem={(s) => {
              update("page.games.viewType", s as string);
            }}
            size="2xs"
            items={viewTypeList.map((item) => ({
              ...item,
              label: item.key,
              value: <Icon as={item.icon} />,
            }))}
            withTooltip
          />
          <Button
            leftIcon={<LuPlus />}
            size="xs"
            colorScheme={primaryColor}
            variant={primaryColor === "gray" ? "subtle" : "outline"}
            onClick={() => {}} // TODO
          >
            {t("AllGamesPage.button.addAndImport")}
          </Button>
          <Button
            leftIcon={<LuPlay />}
            size="xs"
            colorScheme={primaryColor}
            isDisabled={!selectedGameInstance}
            onClick={() => {}} // TODO
          >
            {t("AllGamesPage.button.launch")}
          </Button>
        </HStack>
      }
    >
      <Box overflow="auto" flexGrow={1} rounded="md">
        <GamesView
          games={gameInstanceSummaryList}
          viewType={selectedViewType}
        />
      </Box>
    </Section>
  );
};

export default AllGamesPage;

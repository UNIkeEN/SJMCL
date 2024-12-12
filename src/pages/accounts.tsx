import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  HStack,
  Icon,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCirclePlus,
  LuLayoutGrid,
  LuLayoutList,
  LuLink2Off,
  LuPlus,
  LuServer,
  LuUsersRound,
} from "react-icons/lu";
import NavMenu from "@/components/common/nav-menu";
import SegmentedControl from "@/components/common/segmented";
import SelectableButton from "@/components/common/selectable-button";
import AddPlayerModal from "@/components/modals/add-player-modal";
import PlayersView from "@/components/players-view";
import { useLauncherConfig } from "@/contexts/config";
import { useData } from "@/contexts/data";

const AccountsPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const selectedViewType = config.page.accounts.viewType;

  const [selectedPlayerType, setSelectedPlayerType] = useState<string>("all");
  const { playerList, authServerList } = useData();

  const {
    isOpen: isAddPlayerModalOpen,
    onOpen: onAddPlayerModalOpen,
    onClose: onAddPlayerModalClose,
  } = useDisclosure();

  const playerTypeList = [
    {
      key: "all",
      icon: LuUsersRound,
      label: t("AccountsPage.playerTypeList.all"),
    },
    { key: "offline", icon: LuLink2Off, label: t("Enums.playerTypes.offline") },
    ...authServerList.map((server) => ({
      key: server.authUrl,
      icon: LuServer,
      label: server.name,
    })),
  ];

  const viewTypeList = [
    {
      key: "grid",
      icon: LuLayoutGrid,
      tooltip: t("AccountsPage.viewTypeList.grid"),
    },
    {
      key: "list",
      icon: LuLayoutList,
      tooltip: t("AccountsPage.viewTypeList.list"),
    },
  ];

  const filterPlayersByType = (type: string) => {
    if (type === "all") {
      return playerList;
    } else if (type === "offline") {
      return playerList.filter((player) => player.type === "offline");
    } else {
      return playerList.filter(
        (player) =>
          player.type === "3rdparty" &&
          authServerList.find((server) => server.authUrl === type)?.authUrl ===
            player.authServer?.authUrl
      );
    }
  };

  return (
    <>
      <Grid templateColumns="1fr 3fr" gap={4} h="100%">
        <GridItem className="content-full-y">
          <VStack align="stretch" h="100%">
            <Box flex="1" overflowY="auto">
              <NavMenu
                selectedKeys={[selectedPlayerType]}
                onClick={(value) => {
                  setSelectedPlayerType(value);
                }}
                items={playerTypeList.map((item) => ({
                  label: (
                    <HStack spacing={2} overflow="hidden">
                      <Icon as={item.icon} />
                      <Text fontSize="sm">{item.label}</Text>
                    </HStack>
                  ),
                  value: item.key,
                }))}
              />
            </Box>
            <SelectableButton mt="auto" size="sm">
              <HStack spacing={2}>
                <Icon as={LuCirclePlus} />
                <Text fontSize="sm">
                  {t("AccountsPage.Button.add3rdPartySource")}
                </Text>
              </HStack>
            </SelectableButton>
          </VStack>
        </GridItem>
        <GridItem className="content-full-y">
          <Box display="flex" flexDirection="column" height="100%">
            <Flex alignItems="flex-start" flexShrink={0}>
              <VStack spacing={0} align="start">
                <Text fontWeight="bold" fontSize="sm" className="no-select">
                  {
                    playerTypeList.find(
                      (item) => item.key === selectedPlayerType
                    )?.label
                  }
                </Text>
                {!["all", "offline"].includes(selectedPlayerType) && (
                  <Text fontSize="xs" className="secondary-text no-select">
                    {selectedPlayerType}
                  </Text>
                )}
              </VStack>
              <HStack spacing={2} ml="auto" alignItems="flex-start">
                <SegmentedControl
                  selected={selectedViewType}
                  onSelectItem={(s) => {
                    update("page.accounts.viewType", s as string);
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
                  onClick={onAddPlayerModalOpen}
                >
                  {t("AccountsPage.Button.addPlayer")}
                </Button>
              </HStack>
            </Flex>
            <Box overflow="auto" flexGrow={1} mt={2.5} rounded="md">
              <PlayersView
                players={filterPlayersByType(selectedPlayerType)}
                viewType={selectedViewType}
              />
            </Box>
          </Box>
        </GridItem>
      </Grid>
      <AddPlayerModal
        isOpen={isAddPlayerModalOpen}
        onClose={onAddPlayerModalClose}
        initialPlayerType={
          selectedPlayerType === "all" || selectedPlayerType === "offline"
            ? "offline"
            : "3rdparty"
        }
        initialAuthServerUrl={
          selectedPlayerType === "all" || selectedPlayerType === "offline"
            ? ""
            : selectedPlayerType
        }
        isCentered
      />
    </>
  );
};

export default AccountsPage;

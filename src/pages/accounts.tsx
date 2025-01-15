import {
  Box,
  Button,
  Grid,
  GridItem,
  HStack,
  Icon,
  IconButton,
  Text,
  Tooltip,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCirclePlus,
  LuHouse,
  LuLayoutGrid,
  LuLayoutList,
  LuLink2Off,
  LuPlus,
  LuServer,
  LuServerOff,
  LuUsersRound,
} from "react-icons/lu";
import NavMenu from "@/components/common/nav-menu";
import { Section } from "@/components/common/section";
import SegmentedControl from "@/components/common/segmented";
import SelectableButton from "@/components/common/selectable-button";
import AddAuthServerModal from "@/components/modals/add-auth-server-modal";
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
    isOpen: isAddAuthServerModalOpen,
    onOpen: onAddAuthServerModalOpen,
    onClose: onAddAuthServerModalClose,
  } = useDisclosure();

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
      return playerList.filter((player) => player.playerType === "offline");
    } else {
      return playerList.filter(
        (player) =>
          player.playerType === "3rdparty" &&
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
            <SelectableButton
              mt="auto"
              size="sm"
              onClick={onAddAuthServerModalOpen}
            >
              <HStack spacing={2}>
                <Icon as={LuCirclePlus} />
                <Text fontSize="sm">
                  {t("AccountsPage.Button.add3rdPartyServer")}
                </Text>
              </HStack>
            </SelectableButton>
          </VStack>
        </GridItem>
        <GridItem className="content-full-y">
          <Section
            display="flex"
            flexDirection="column"
            height="100%"
            title={
              playerTypeList.find((item) => item.key === selectedPlayerType)
                ?.label
            }
            description={
              !["all", "offline"].includes(selectedPlayerType)
                ? selectedPlayerType
                : undefined
            }
            headExtra={
              <HStack spacing={2} alignItems="flex-start">
                {!["all", "offline"].includes(selectedPlayerType) && (
                  <Tooltip label={t("AccountsPage.Button.sourceHomepage")}>
                    <IconButton
                      aria-label="home"
                      size="xs"
                      variant="ghost"
                      icon={<LuHouse />}
                    />
                  </Tooltip>
                )}
                {!["all", "offline"].includes(selectedPlayerType) && (
                  <Tooltip label={t("AccountsPage.Button.deleteServer")}>
                    <IconButton
                      aria-label="home"
                      size="xs"
                      colorScheme="red"
                      variant="ghost"
                      icon={<LuServerOff />}
                    />
                  </Tooltip>
                )}
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
                  withTooltip
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
            }
          >
            <Box overflow="auto" flexGrow={1} rounded="md">
              <PlayersView
                players={filterPlayersByType(selectedPlayerType)}
                viewType={selectedViewType}
              />
            </Box>
          </Section>
        </GridItem>
      </Grid>
      <AddAuthServerModal
        isOpen={isAddAuthServerModalOpen}
        onClose={onAddAuthServerModalClose}
        isCentered
      />
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

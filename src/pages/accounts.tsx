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
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCirclePlus,
  LuGrid2X2,
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
import AddPlayerModal from "@/components/modals/add-player-modal";
import GenericConfirmDialog from "@/components/modals/generic-confirm-dialog";
import PlayersView from "@/components/players-view";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { AuthServer, Player } from "@/models/account";
import { AccountService } from "@/services/account";

const AccountsPage = () => {
  const { t } = useTranslation();
  const { config, update, refreshConfig } = useLauncherConfig();
  const toast = useToast();
  const primaryColor = config.appearance.theme.primaryColor;
  const selectedViewType = config.states.accountsPage.viewType;
  const { openSharedModal } = useSharedModals();

  const { getPlayerList, getAuthServerList, selectedPlayer } = useGlobalData();

  const [selectedPlayerType, setSelectedPlayerType] = useState<string>("all");
  const [playerList, setPlayerList] = useState<Player[]>([]);
  const [authServerList, setAuthServerList] = useState<AuthServer[]>([]);

  useEffect(() => {
    setPlayerList(getPlayerList() || []);
  }, [getPlayerList]);

  useEffect(() => {
    setAuthServerList(getAuthServerList() || []);
  }, [getAuthServerList]);

  const {
    isOpen: isDeleteAuthServerDialogOpen,
    onOpen: onDeleteAuthServerDialogOpen,
    onClose: onDeleteAuthServerDialogClose,
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
    {
      key: "microsoft",
      icon: LuGrid2X2,
      label: t("Enums.playerTypes.microsoft"),
    },
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
    } else if (type === "microsoft") {
      return playerList.filter((player) => player.playerType === "microsoft");
    } else {
      return playerList.filter(
        (player) =>
          player.playerType === "3rdparty" &&
          authServerList.find((server) => server.authUrl === type)?.authUrl ===
            player.authServer?.authUrl
      );
    }
  };

  const handleDeleteAuthServer = () => {
    let servers = authServerList.filter(
      (server) => server.authUrl === selectedPlayerType
    );
    if (servers.length > 0) {
      AccountService.deleteAuthServer(servers[0].authUrl).then((response) => {
        if (response.status === "success") {
          getAuthServerList(true);
          Promise.all([
            getPlayerList(true),
            refreshConfig(), // sync update selected player id in frontend
          ]);
          // redirect the selected player type to "all" to avoid display error
          setSelectedPlayerType("all");
          toast({
            title: response.message,
            status: "success",
          });
        } else {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
      });
    }
    onDeleteAuthServerDialogClose();
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
              onClick={() => {
                openSharedModal("add-auth-server", {});
              }}
            >
              <HStack spacing={2}>
                <Icon as={LuCirclePlus} />
                <Text fontSize="sm">
                  {t("AccountsPage.button.add3rdPartyServer")}
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
              !["all", "offline", "microsoft"].includes(selectedPlayerType)
                ? selectedPlayerType
                : undefined
            }
            headExtra={
              <HStack spacing={2} alignItems="flex-start">
                {!["all", "offline", "microsoft"].includes(
                  selectedPlayerType
                ) && (
                  <Tooltip label={t("AccountsPage.button.sourceHomepage")}>
                    <IconButton
                      aria-label="home"
                      size="xs"
                      fontSize="sm"
                      variant="ghost"
                      icon={<LuHouse />}
                      onClick={() => {
                        const homepageUrl = authServerList.find(
                          (server) => server.authUrl === selectedPlayerType
                        )?.homepageUrl;
                        if (homepageUrl) {
                          openUrl(homepageUrl);
                        }
                      }}
                    />
                  </Tooltip>
                )}
                {!["all", "offline", "microsoft"].includes(
                  selectedPlayerType
                ) && (
                  <Tooltip label={t("AccountsPage.button.deleteServer")}>
                    <IconButton
                      aria-label="home"
                      size="xs"
                      fontSize="sm"
                      colorScheme="red"
                      variant="ghost"
                      icon={<LuServerOff />}
                      onClick={onDeleteAuthServerDialogOpen}
                    />
                  </Tooltip>
                )}
                <SegmentedControl
                  selected={selectedViewType}
                  onSelectItem={(s) => {
                    update("states.accountsPage.viewType", s as string);
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
                  onClick={onAddPlayerModalOpen}
                >
                  {t("AccountsPage.button.addPlayer")}
                </Button>
              </HStack>
            }
          >
            <Box overflow="auto" flexGrow={1} rounded="md">
              <PlayersView
                selectedPlayer={selectedPlayer}
                players={filterPlayersByType(selectedPlayerType)}
                viewType={selectedViewType}
              />
            </Box>
          </Section>
        </GridItem>
      </Grid>
      <GenericConfirmDialog
        isAlert
        isOpen={isDeleteAuthServerDialogOpen}
        onClose={onDeleteAuthServerDialogClose}
        title={t("DeleteAuthServerAlertDialog.dialog.title")}
        body={t("DeleteAuthServerAlertDialog.dialog.content", {
          name: authServerList.find(
            (server) => server.authUrl === selectedPlayerType
          )?.name,
        })}
        btnOK={t("General.delete")}
        btnCancel={t("General.cancel")}
        onOKCallback={handleDeleteAuthServer}
      />
      <AddPlayerModal
        isOpen={isAddPlayerModalOpen}
        onClose={onAddPlayerModalClose}
        initialPlayerType={
          selectedPlayerType === "all" || selectedPlayerType === "offline"
            ? "offline"
            : selectedPlayerType === "microsoft"
              ? "microsoft"
              : "3rdparty"
        }
        initialAuthServerUrl={
          ["all", "offline", "microsoft"].includes(selectedPlayerType)
            ? ""
            : selectedPlayerType
        }
      />
    </>
  );
};

export default AccountsPage;

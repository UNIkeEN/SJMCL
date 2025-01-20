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
import { open } from "@tauri-apps/plugin-shell";
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
import GenericConfirmDialog from "@/components/modals/generic-confirm-dialog";
import PlayersView from "@/components/players-view";
import { useLauncherConfig } from "@/contexts/config";
import { useData, useDataDispatch } from "@/contexts/data";
import { useToast } from "@/contexts/toast";
import { AuthServerError, errorToLocaleKey } from "@/models/account";
import {
  deleteAuthServer,
  getAuthServerList,
  getPlayerList,
} from "@/services/account";

const AccountsPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const toast = useToast();
  const primaryColor = config.appearance.theme.primaryColor;
  const selectedViewType = config.page.accounts.viewType;

  const [selectedPlayerType, setSelectedPlayerType] = useState<string>("all");
  const { selectedPlayer, playerList, authServerList } = useData();
  const { setSelectedPlayer, setPlayerList, setAuthServerList } =
    useDataDispatch();

  const {
    isOpen: isAddAuthServerModalOpen,
    onOpen: onAddAuthServerModalOpen,
    onClose: onAddAuthServerModalClose,
  } = useDisclosure();

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

  const handleDeleteAuthServer = () => {
    (async () => {
      try {
        let servers = authServerList.filter(
          (server) => server.authUrl === selectedPlayerType
        );
        if (servers.length > 0) {
          let url = servers[0].authUrl;
          await deleteAuthServer(url);
          // check if the selected player was deleted with the server
          if (selectedPlayer?.authServer?.authUrl === url) {
            setSelectedPlayer(undefined);
          }
          // update the new player list & auth server list
          setPlayerList(await getPlayerList());
          setAuthServerList(await getAuthServerList());
          // redirect the selected player type to "all" to avoid display error
          setSelectedPlayerType("all");
          toast({
            title: t("Services.account.deleteAuthServer.success"),
            status: "success",
          });
        }
      } catch (error) {
        toast({
          title: t("Services.account.deleteAuthServer.error.title"),
          description: t(
            `Services.account.deleteAuthServer.error.description.${errorToLocaleKey(error)}`
          ),
          status: "error",
        });
      } finally {
        onDeleteAuthServerDialogClose();
      }
    })();
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
              !["all", "offline"].includes(selectedPlayerType)
                ? selectedPlayerType
                : undefined
            }
            headExtra={
              <HStack spacing={2} alignItems="flex-start">
                {!["all", "offline"].includes(selectedPlayerType) && (
                  <Tooltip label={t("AccountsPage.button.sourceHomepage")}>
                    <IconButton
                      aria-label="home"
                      size="xs"
                      variant="ghost"
                      icon={<LuHouse />}
                      onClick={() => {
                        const homepageUrl = authServerList.find(
                          (server) => server.authUrl === selectedPlayerType
                        )?.homepageUrl;
                        if (homepageUrl) {
                          open(homepageUrl);
                        }
                      }}
                    />
                  </Tooltip>
                )}
                {!["all", "offline"].includes(selectedPlayerType) && (
                  <Tooltip label={t("AccountsPage.button.deleteServer")}>
                    <IconButton
                      aria-label="home"
                      size="xs"
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
                  {t("AccountsPage.button.addPlayer")}
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
      />
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
            : "3rdparty"
        }
        initialAuthServerUrl={
          selectedPlayerType === "all" || selectedPlayerType === "offline"
            ? ""
            : selectedPlayerType
        }
      />
    </>
  );
};

export default AccountsPage;

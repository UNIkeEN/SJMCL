import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  HStack,
  Input,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import router from "next/router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCopy, LuRefreshCcw } from "react-icons/lu";
import { TbHanger } from "react-icons/tb";
import ManageSkinModal from "@/components/modals/manage-skin-modal";
import ViewSkinModal from "@/components/modals/view-skin-modal";
import PlayerAvatar from "@/components/player-avatar";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { PlayerType } from "@/enums/account";
import { AccountServiceError } from "@/enums/service-error";
import { Player } from "@/models/account";
import { AccountService } from "@/services/account";
import { isOfflinePlayernameValid } from "@/utils/account";
import { copyText } from "@/utils/copy";

// easy-launcher accounts page: offline-first — sidebar list + detail panel +
// offline add form. No auth servers, no import, no Microsoft login.

const AccountsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { openSharedModal } = useSharedModals();
  const { getPlayerList, selectedPlayer } = useGlobalData();
  const { update } = useLauncherConfig();

  const [playerList, setPlayerList] = useState<Player[]>([]);
  // the account being viewed in the right panel; "add" = add-account form
  const [viewId, setViewId] = useState<string>("add");
  const [newName, setNewName] = useState<string>("");
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    isOpen: isSkinModalOpen,
    onOpen: onSkinModalOpen,
    onClose: onSkinModalClose,
  } = useDisclosure();

  useEffect(() => {
    setPlayerList(getPlayerList() || []);
  }, [getPlayerList]);

  // keep the viewed account valid after list changes
  useEffect(() => {
    if (viewId !== "add" && !playerList.some((p) => p.id === viewId)) {
      setViewId(selectedPlayer?.id || "add");
    }
  }, [playerList, selectedPlayer, viewId]);

  // /accounts?add opens the add-account form directly
  useEffect(() => {
    if (router.query.add) {
      setViewId("add");
      router.replace("/accounts", undefined, { shallow: true });
    }
  }, []);

  const viewed = playerList.find((p) => p.id === viewId);

  const handleAddOffline = () => {
    if (!newName.trim() || !isOfflinePlayernameValid(newName.trim())) return;
    setIsBusy(true);
    AccountService.addPlayerOffline(newName.trim()).then((response) => {
      if (response.status === "success") {
        getPlayerList(true);
        setNewName("");
        toast({ title: response.message, status: "success" });
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
      setIsBusy(false);
    });
  };

  const handleActivate = () => {
    if (!viewed) return;
    update("states.shared.selectedPlayerId", viewed.id);
  };

  const handleCopyUuid = () => {
    if (!viewed) return;
    copyText(viewed.uuid, { toast });
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  const handleRefresh = () => {
    if (!viewed) return;
    AccountService.refreshPlayer(viewed.id).then((response) => {
      if (response.status === "success") {
        getPlayerList(true);
        toast({ title: response.message, status: "success" });
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
        if (response.raw_error === AccountServiceError.Expired) {
          openSharedModal("relogin", {
            player: viewed,
            onSuccess: () => getPlayerList(true),
          });
        }
      }
    });
  };

  const handleLogoutClick = () => {
    if (!viewed) return;
    if (!confirming) {
      // two-step logout: arm, revert after 3s
      setConfirming(true);
      confirmTimerRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirming(false);
    AccountService.deletePlayer(viewed.id).then((response) => {
      if (response.status === "success") {
        getPlayerList(true);
        toast({ title: response.message, status: "success" });
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  };

  const renderAccountItem = (player: Player) => {
    const isActive = selectedPlayer?.id === player.id;
    return (
      <Button
        key={player.id}
        variant="ghost"
        w="100%"
        h="48px"
        justifyContent="flex-start"
        gap={3}
        px={3}
        borderRadius="el-sm"
        bg={viewId === player.id ? "surface" : "transparent"}
        color={viewId === player.id ? "ink" : "muted"}
        _hover={{ color: "ink" }}
        onClick={() => setViewId(player.id)}
      >
        <PlayerAvatar
          avatar={player.avatar}
          boxSize="32px"
          borderRadius="el-sm"
          objectFit="cover"
          flexShrink={0}
        />
        <Box flex="1" minW={0} textAlign="left">
          <Text fontSize="sm" fontWeight="600" className="ellipsis-text">
            {player.name}
          </Text>
          <Text fontSize="xs" color="muted" className="ellipsis-text">
            {t("AccountsPage.playerType.offline")}
          </Text>
        </Box>
        {isActive && (
          <Box w="6px" h="6px" borderRadius="50%" bg="ink" flexShrink={0} />
        )}
      </Button>
    );
  };

  const renderDetail = (player: Player) => {
    const isActive = selectedPlayer?.id === player.id;
    const isOffline = player.playerType === PlayerType.Offline;
    const skin = player.textures.find(
      (texture) => texture.textureType === "SKIN"
    );
    const cape = player.textures.find(
      (texture) => texture.textureType === "CAPE"
    );
    return (
      <Box maxW="900px" mx="auto">
        {/* hero */}
        <HStack gap={4} py={5} pb={3}>
          <PlayerAvatar
            avatar={player.avatar}
            boxSize="64px"
            borderRadius="el-sm"
            objectFit="cover"
          />
          <Box minW={0}>
            <HStack>
              <Text fontSize="xl" fontWeight="600" className="ellipsis-text">
                {player.name}
              </Text>
              {isActive && (
                <Box
                  as="span"
                  px={2}
                  py="1px"
                  border="1px solid"
                  borderColor="line"
                  borderRadius="el-sm"
                  fontSize="xs"
                  color="ink"
                  flexShrink={0}
                >
                  {t("AccountsPage.tag.active")}
                </Box>
              )}
            </HStack>
            <Text fontSize="sm" color="muted" className="ellipsis-text">
              {t("AccountsPage.playerType.offline")}
            </Text>
          </Box>
        </HStack>

        {/* UUID */}
        <HStack minH="64px" py={3} borderTop="1px solid" borderColor="line">
          <Box flex="1" minW={0}>
            <Text fontWeight="600">{t("AccountsPage.detail.uuid")}</Text>
          </Box>
          <HStack flexShrink={0} minW={0}>
            <Text color="muted" fontSize="sm" className="ellipsis-text">
              {player.uuid || "-"}
            </Text>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LuCopy />}
              onClick={handleCopyUuid}
              isDisabled={!player.uuid}
            >
              {isCopied
                ? t("AccountsPage.button.copied")
                : t("AccountsPage.button.copy")}
            </Button>
          </HStack>
        </HStack>

        {/* token */}
        <HStack minH="64px" py={3} borderTop="1px solid" borderColor="line">
          <Box flex="1">
            <Text fontWeight="600">{t("AccountsPage.detail.token")}</Text>
          </Box>
          <HStack flexShrink={0}>
            <Text color="muted" fontSize="sm">
              {isOffline
                ? t("AccountsPage.token.noToken")
                : t("AccountsPage.token.valid")}
            </Text>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LuRefreshCcw />}
              onClick={handleRefresh}
              isDisabled={isOffline}
            >
              {t("General.refresh")}
            </Button>
          </HStack>
        </HStack>

        {/* skin */}
        <HStack minH="64px" py={3} borderTop="1px solid" borderColor="line">
          <Box flex="1">
            <Text fontWeight="600">{t("AccountsPage.detail.skin")}</Text>
          </Box>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<TbHanger />}
            onClick={onSkinModalOpen}
          >
            {t(`AccountsPage.button.${isOffline ? "manageSkin" : "viewSkin"}`)}
          </Button>
        </HStack>

        {/* actions */}
        <HStack pt={6} gap={2}>
          <Button
            size="sm"
            bg="ink"
            color="onInk"
            _hover={{ bg: "ink", opacity: 0.85 }}
            onClick={handleActivate}
            isDisabled={isActive || isBusy}
          >
            {isActive
              ? t("AccountsPage.button.activeAccount")
              : t("AccountsPage.button.makeActive")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLogoutClick}
            bg={confirming ? "surface" : "transparent"}
          >
            {confirming
              ? t("AccountsPage.button.confirmLogout")
              : t("AccountsPage.button.logout")}
          </Button>
        </HStack>

        {isOffline ? (
          <ManageSkinModal
            isOpen={isSkinModalOpen}
            onClose={onSkinModalClose}
            playerId={player.id}
            skin={skin}
            cape={cape}
          />
        ) : (
          <ViewSkinModal
            isOpen={isSkinModalOpen}
            onClose={onSkinModalClose}
            skin={skin}
            cape={cape}
          />
        )}
      </Box>
    );
  };

  const renderAddForm = () => (
    <Box maxW="900px" mx="auto">
      <Text as="h2" fontSize="xl" fontWeight="600" py={5} pb={3}>
        {t("AccountsPage.addForm.title")}
      </Text>

      <HStack
        minH="64px"
        py={3}
        borderTop="1px solid"
        borderColor="line"
        gap={4}
      >
        <Box flex="1">
          <Text fontWeight="600">{t("AccountsPage.playerType.offline")}</Text>
          <Text fontSize="sm" color="muted">
            {t("AccountsPage.addForm.offlineHint")}
          </Text>
        </Box>
        <HStack flexShrink={0} gap={2}>
          <Input
            size="sm"
            w="220px"
            placeholder={t("AddPlayerModal.offline.playerName.placeholder")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddOffline()}
          />
          <Button
            size="sm"
            bg="ink"
            color="onInk"
            _hover={{ bg: "ink", opacity: 0.85 }}
            onClick={handleAddOffline}
            isLoading={isBusy}
            isDisabled={!newName.trim()}
          >
            {t("AccountsPage.button.add")}
          </Button>
        </HStack>
      </HStack>
    </Box>
  );

  return (
    <Grid templateColumns="240px minmax(0,1fr)" gap={0} h="100%">
      <GridItem
        className="content-full-y"
        borderRight="1px solid"
        borderColor="line"
        p={3}
        pt={4}
      >
        <VStack align="stretch" h="100%" spacing={3}>
          <Box flex="1" overflowY="auto">
            <VStack align="stretch" spacing={1}>
              {playerList.map(renderAccountItem)}
              {playerList.length === 0 && (
                <Text fontSize="sm" color="muted" p={3}>
                  {t("AccountsPage.addForm.empty")}
                </Text>
              )}
            </VStack>
          </Box>
          <Button
            w="100%"
            size="sm"
            variant="ghost"
            bg={viewId === "add" ? "surface" : "transparent"}
            onClick={() => setViewId("add")}
          >
            {t("AccountsPage.button.addPlayer")}
          </Button>
        </VStack>
      </GridItem>
      <GridItem className="content-full-y" px={6}>
        <Flex direction="column" h="100%">
          {viewId === "add" || !viewed ? renderAddForm() : renderDetail(viewed)}
        </Flex>
      </GridItem>
    </Grid>
  );
};

export default AccountsPage;

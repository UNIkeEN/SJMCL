import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  ButtonProps,
  Grid,
  HStack,
  Icon,
  Image,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Spinner,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { fetch } from "@tauri-apps/plugin-http";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import { LuCopy, LuDownload, LuHouse, LuUsers } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useToast } from "@/contexts/toast";
import { MultiplayerService } from "@/services/multiplayer";
import { copyText } from "@/utils/copy";

const TERRACOTTA_ICON_URL =
  "https://zh.minecraft.wiki/images/Red_Glazed_Terracotta_JE1_BE1.png?272a2";

const ERROR_TYPE_TO_KEY: Record<number, string> = {
  0: "PING_HOST_FAIL",
  1: "PING_HOST_RST",
  2: "GUEST_ET_CRASH",
  3: "HOST_ET_CRASH",
  4: "PING_SERVER_RST",
  5: "SCAFFOLDING_INVALID_RESPONSE",
};

type Phase =
  | "checking"
  | "notDownloaded"
  | "ready"
  | "scanning"
  | "roomStarted"
  | "guestStarting"
  | "guestOk"
  | "error"
  | "disconnected";

interface MultiplayerActionButtonProps extends ButtonProps {
  icon: IconType;
  imageSrc?: string;
  title: string;
}

const MultiplayerActionButton: React.FC<MultiplayerActionButtonProps> = ({
  icon,
  imageSrc,
  title,
  ...props
}) => {
  const bg = useColorModeValue("rgba(255, 255, 255, 0.62)", "whiteAlpha.120");
  const borderColor = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
  const hoverBg = useColorModeValue(
    "rgba(255, 255, 255, 0.8)",
    "whiteAlpha.180"
  );
  const textColor = useColorModeValue("gray.800", "whiteAlpha.900");

  return (
    <Button
      w="100%"
      h="auto"
      minH="5.5rem"
      px={4}
      py={4}
      borderRadius="xl"
      borderWidth="1px"
      borderColor={borderColor}
      bg={bg}
      color={textColor}
      justifyContent="flex-start"
      textAlign="left"
      whiteSpace="normal"
      backdropFilter="blur(16px)"
      boxShadow="sm"
      _hover={{ bg: hoverBg, transform: "translateY(-1px)" }}
      _active={{ transform: "translateY(0)" }}
      _disabled={{ opacity: 0.55, cursor: "not-allowed" }}
      {...props}
    >
      <HStack spacing={3} align="center" w="100%">
        <Box
          boxSize={9}
          borderRadius="lg"
          bg={useColorModeValue("blackAlpha.100", "whiteAlpha.150")}
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={title}
              boxSize={6}
              objectFit="contain"
              draggable={false}
            />
          ) : (
            <Icon as={icon} boxSize={4.5} />
          )}
        </Box>
        <Text fontSize="sm" fontWeight="semibold" lineHeight="1.2" flex="1">
          {title}
        </Text>
      </HStack>
    </Button>
  );
};

const MultiplayerModal: React.FC<Omit<ModalProps, "children">> = ({
  ...props
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { selectedPlayer } = useGlobalData();

  const [phase, setPhase] = useState<Phase>("checking");
  const [port, setPort] = useState(0);
  const [generatedInviteCode, setGeneratedInviteCode] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  const [errorType, setErrorType] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState("");
  const [profiles, setProfiles] = useState<{ kind: string; name: string }[]>(
    []
  );

  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const pollErrorCountRef = useRef(0);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const StatusPanel: React.FC<{ children: React.ReactNode }> = ({
    children,
  }) => (
    <Box
      borderRadius="xl"
      borderWidth="1px"
      borderColor={modalBorderColor}
      bg={panelBg}
      px={4}
      py={4}
    >
      {children}
    </Box>
  );

  const ProfileList: React.FC<{
    profiles: { kind: string; name: string }[];
  }> = ({ profiles }) => (
    <VStack spacing={3} align="stretch">
      <Text fontSize="sm" fontWeight="bold">
        {t("MultiplayerModal.guest.joined")}
      </Text>
      {profiles.map((p, i) => (
        <Box
          key={`${p.name}-${p.kind}`}
          borderRadius="md"
          borderWidth="1px"
          borderColor={optionBorderColor}
          bg={optionBg}
          px={3}
          py={2}
        >
          <Text fontSize="sm">
            <Text as="span" fontWeight="semibold">
              {p.name}
            </Text>
            <Text as="span" color="gray.500">
              {" "}
              ({p.kind})
            </Text>
          </Text>
        </Box>
      ))}
    </VStack>
  );

  const panelBg = useColorModeValue(
    "rgba(255, 255, 255, 0.7)",
    "rgba(255, 255, 255, 0.08)"
  );
  const modalBg = useColorModeValue(
    "rgba(248, 250, 252, 0.86)",
    "rgba(17, 24, 39, 0.92)"
  );
  const modalBorderColor = useColorModeValue(
    "rgba(15, 23, 42, 0.08)",
    "rgba(255, 255, 255, 0.12)"
  );
  const optionBg = useColorModeValue(
    "rgba(255, 255, 255, 0.62)",
    "whiteAlpha.120"
  );
  const optionBorderColor = useColorModeValue(
    "blackAlpha.200",
    "whiteAlpha.200"
  );
  const optionHoverBg = useColorModeValue(
    "rgba(255, 255, 255, 0.8)",
    "whiteAlpha.180"
  );
  const optionIconBg = useColorModeValue("blackAlpha.100", "whiteAlpha.150");
  const optionTextColor = useColorModeValue("gray.800", "whiteAlpha.900");

  const handleInit = useCallback(async (): Promise<number> => {
    await MultiplayerService.launchTerracotta();
    for (let i = 0; i < 10; i++) {
      const response = await MultiplayerService.fetchPort();
      if (response.status === "success" && response.data) {
        try {
          const test = await fetch(`http://127.0.0.1:${response.data}/state`, {
            signal: AbortSignal.timeout(2000),
          });
          if (test.ok) {
            setPort(response.data);
            return response.data;
          }
        } catch {}
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    toast({
      title: t("MultiplayerModal.toast.launchTimeout"),
      status: "error",
    });
    return 0;
  }, [toast, t]);

  const restoreRoomState = useCallback(
    async (port: number): Promise<boolean> => {
      try {
        const stateRes = await fetch(`http://127.0.0.1:${port}/state`);
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          if (stateData.room) {
            setGeneratedInviteCode(stateData.room);
            setProfiles(stateData.profiles ?? []);
            setPhase("roomStarted");
            return true;
          }
          if (stateData.state === "host-scanning") {
            setPhase("scanning");
            return true;
          }
        }
      } catch {}
      return false;
    },
    []
  );

  const checkTerracottaSupport = useCallback(async () => {
    const response = await MultiplayerService.checkTerracotta();
    if (response.status === "success" && response.data) {
      const port = await handleInit();
      if (port > 0) {
        const restored = await restoreRoomState(port);
        if (!restored) {
          setPhase("ready");
        }
      }
    } else {
      setPhase("notDownloaded");
    }
  }, [handleInit, restoreRoomState]);

  useEffect(() => {
    if (!props.isOpen) return;
    pollErrorCountRef.current = 0;
    setPhase("checking");
    setPort(0);
    setGeneratedInviteCode("");
    setJoinCode("");
    setErrorType(null);
    setDifficulty("");
    setProfiles([]);
    checkTerracottaSupport();
  }, [checkTerracottaSupport, props.isOpen]);

  useEffect(() => {
    if (!props.isOpen || port === 0) return;
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/state`);
        if (response.ok) {
          pollErrorCountRef.current = 0;
          const data = await response.json();
          if (data.state === "exception" && ERROR_TYPE_TO_KEY[data.type]) {
            setErrorType(data.type);
            setPhase("error");
          } else if (data.state === "guest-starting") {
            setDifficulty(data.difficulty ?? "");
            setPhase("guestStarting");
          } else if (data.state === "guest-ok") {
            setProfiles(data.profiles ?? []);
            setPhase("guestOk");
          } else if (data.room) {
            setGeneratedInviteCode(data.room);
            setProfiles(data.profiles ?? []);
            setPhase("roomStarted");
          }
        }
      } catch {
        pollErrorCountRef.current++;
        if (pollErrorCountRef.current >= 3) {
          setPort(0);
          setPhase("disconnected");
        }
      }
    }, 500);
    return () => clearInterval(intervalId);
  }, [props.isOpen, port]);

  const handleReturnToLobby = async () => {
    try {
      await fetch(`http://127.0.0.1:${port}/state/ide`, { method: "GET" });
    } catch {}
    setErrorType(null);
    setPhase("ready");
  };

  const handleReconnect = async () => {
    setPhase("checking");
    const newPort = await handleInit();
    if (newPort > 0) {
      const restored = await restoreRoomState(newPort);
      if (!restored) {
        setPhase("ready");
      }
    }
  };

  const handleCopyInviteCode = async () => {
    if (!generatedInviteCode) return;
    await copyText(generatedInviteCode, { toast });
  };

  const handleCreateRoom = async () => {
    const url = `http://127.0.0.1:${port}/state/scanning?player=${encodeURIComponent(selectedPlayer?.name ?? "")}`;
    setPhase("scanning");
    try {
      await fetch(url, { method: "GET" });
    } catch {
      toast({
        title: t("MultiplayerModal.toast.launchTimeout"),
        status: "error",
      });
      setPhase("ready");
    }
  };

  const handleDownloadTerracotta = async () => {
    setIsDownloading(true);
    const response = await MultiplayerService.downloadTerracotta();
    if (response.status === "success") {
      toast({ title: response.message, status: "success" });
      await checkTerracottaSupport();
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
    }
    setIsDownloading(false);
  };

  const handleJoinRoomConfirm = async () => {
    setIsJoining(true);
    const url = `http://127.0.0.1:${port}/state/guesting?room=${encodeURIComponent(joinCode.trim())}&player=${encodeURIComponent(selectedPlayer?.name ?? "")}`;
    try {
      const response = await fetch(url, { method: "GET" });
      if (!response.ok) {
        toast({
          title: t("MultiplayerModal.toast.joinTimeout"),
          status: "error",
        });
      }
    } catch (e) {
      toast({ title: String(e), status: "error" });
    }
    setIsJoining(false);
    setIsJoinDialogOpen(false);
  };

  return (
    <>
      <Modal autoFocus={false} size={{ base: "md", lg: "lg" }} {...props}>
        <ModalOverlay backdropFilter="blur(6px)" />
        <ModalContent
          bg={modalBg}
          borderWidth="1px"
          borderColor={modalBorderColor}
          borderRadius="2xl"
          boxShadow="2xl"
          backdropFilter="blur(24px)"
          overflow="hidden"
        >
          <ModalHeader>{t("MultiplayerModal.header.title")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={5} align="stretch">
              {phase === "checking" && (
                <StatusPanel>
                  <HStack spacing={3}>
                    <Spinner size="sm" color={`${primaryColor}.500`} />
                    <Text fontSize="sm">
                      {t("MultiplayerModal.status.checking")}
                    </Text>
                  </HStack>
                </StatusPanel>
              )}

              {phase === "notDownloaded" && (
                <>
                  <StatusPanel>
                    <Text fontSize="lg" fontWeight="bold">
                      {t("MultiplayerModal.status.notReady")}
                    </Text>
                  </StatusPanel>
                  <Grid
                    templateColumns={{ base: "1fr", md: "1fr 1fr" }}
                    gap={3}
                  >
                    <MultiplayerActionButton
                      icon={LuDownload}
                      imageSrc={TERRACOTTA_ICON_URL}
                      title={t("MultiplayerModal.button.downloadCore")}
                      isLoading={isDownloading}
                      onClick={handleDownloadTerracotta}
                    />
                    <Menu placement="bottom-end">
                      <MenuButton
                        as={Button}
                        w="100%"
                        h="auto"
                        minH="5.5rem"
                        px={4}
                        py={4}
                        borderRadius="xl"
                        borderWidth="1px"
                        borderColor={optionBorderColor}
                        bg={optionBg}
                        color={optionTextColor}
                        textAlign="left"
                        whiteSpace="normal"
                        backdropFilter="blur(16px)"
                        boxShadow="sm"
                        _hover={{
                          bg: optionHoverBg,
                          transform: "translateY(-1px)",
                        }}
                        _active={{ transform: "translateY(0)" }}
                      >
                        <HStack spacing={3} align="center" w="100%">
                          <Box
                            boxSize={9}
                            borderRadius="lg"
                            bg={optionIconBg}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            flexShrink={0}
                          >
                            <Image
                              src={TERRACOTTA_ICON_URL}
                              alt={t(
                                "MultiplayerModal.button.thirdPartyChannels"
                              )}
                              boxSize={6}
                              objectFit="contain"
                              draggable={false}
                            />
                          </Box>
                          <Text
                            fontSize="sm"
                            fontWeight="semibold"
                            lineHeight="short"
                            flex="1"
                          >
                            {t("MultiplayerModal.button.thirdPartyChannels")}
                          </Text>
                        </HStack>
                      </MenuButton>
                      <MenuList>
                        <MenuItem
                          onClick={() =>
                            openUrl("https://github.com/burningtnt/Terracotta")
                          }
                        >
                          {t("MultiplayerModal.menu.githubReleasePage")}
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  </Grid>
                </>
              )}

              {phase === "ready" && (
                <>
                  <StatusPanel>
                    <Text fontSize="lg" fontWeight="bold">
                      {t("MultiplayerModal.status.ready")}
                    </Text>
                  </StatusPanel>
                  <Grid
                    templateColumns={{ base: "1fr", md: "1fr 1fr" }}
                    gap={3}
                  >
                    <MultiplayerActionButton
                      icon={LuHouse}
                      imageSrc={TERRACOTTA_ICON_URL}
                      title={t("MultiplayerModal.button.createRoom")}
                      onClick={handleCreateRoom}
                    />
                    <MultiplayerActionButton
                      icon={LuUsers}
                      imageSrc={TERRACOTTA_ICON_URL}
                      title={t("MultiplayerModal.button.joinRoom")}
                      onClick={() => {
                        setJoinCode("");
                        setIsJoinDialogOpen(true);
                      }}
                    />
                  </Grid>
                </>
              )}

              {phase === "scanning" && (
                <>
                  <StatusPanel>
                    <HStack spacing={3}>
                      <Spinner size="sm" color={`${primaryColor}.500`} />
                      <Text fontSize="sm">
                        {t("MultiplayerModal.runtimeState.host-scanning")}
                      </Text>
                    </HStack>
                  </StatusPanel>
                  <Button variant="ghost" onClick={handleReturnToLobby}>
                    {t("MultiplayerModal.guest.stop")}
                  </Button>
                </>
              )}

              {phase === "roomStarted" && (
                <>
                  {generatedInviteCode && (
                    <Box
                      borderRadius="xl"
                      borderWidth="1px"
                      borderColor={modalBorderColor}
                      bg={panelBg}
                      px={4}
                      py={3}
                    >
                      <HStack
                        justify="space-between"
                        spacing={3}
                        align="center"
                      >
                        <VStack spacing={1} align="start">
                          <Text fontSize="xs" className="secondary-text">
                            {t("MultiplayerModal.label.roomInviteCode")}
                          </Text>
                          <Text fontSize="md" fontWeight="bold">
                            {generatedInviteCode}
                          </Text>
                        </VStack>
                        <Button
                          size="sm"
                          variant="ghost"
                          leftIcon={<LuCopy />}
                          onClick={handleCopyInviteCode}
                        >
                          {t("MultiplayerModal.button.copyInviteCode")}
                        </Button>
                      </HStack>
                    </Box>
                  )}

                  {profiles.length > 0 && (
                    <StatusPanel>
                      <ProfileList profiles={profiles} />
                    </StatusPanel>
                  )}

                  <Button variant="ghost" onClick={handleReturnToLobby}>
                    {t("MultiplayerModal.guest.closeRoom")}
                  </Button>
                </>
              )}

              {phase === "error" && errorType !== null && (
                <>
                  <StatusPanel>
                    <Text fontSize="sm">
                      {t(
                        "MultiplayerModal.error.description." +
                          ERROR_TYPE_TO_KEY[errorType]
                      )}
                    </Text>
                  </StatusPanel>
                  <Button variant="ghost" onClick={handleReturnToLobby}>
                    {t("MultiplayerModal.error.return")}
                  </Button>
                </>
              )}

              {phase === "disconnected" && (
                <>
                  <StatusPanel>
                    <Text fontSize="sm">
                      {t("MultiplayerModal.status.disconnected")}
                    </Text>
                  </StatusPanel>
                  <Button variant="ghost" onClick={handleReconnect}>
                    {t("MultiplayerModal.button.reconnect")}
                  </Button>
                </>
              )}

              {phase === "guestStarting" && (
                <>
                  <StatusPanel>
                    <VStack spacing={2} align="stretch">
                      <Text fontSize="sm">
                        {t("MultiplayerModal.guest.starting")}
                      </Text>
                      <Text fontSize="xs" className="secondary-text">
                        {t("MultiplayerModal.guest.difficulty")}: {difficulty}
                      </Text>
                    </VStack>
                  </StatusPanel>
                  <Button variant="ghost" onClick={handleReturnToLobby}>
                    {t("MultiplayerModal.guest.stop")}
                  </Button>
                </>
              )}

              {phase === "guestOk" && (
                <>
                  <StatusPanel>
                    <ProfileList profiles={profiles} />
                  </StatusPanel>
                  <Button variant="ghost" onClick={handleReturnToLobby}>
                    {t("MultiplayerModal.guest.leave")}
                  </Button>
                </>
              )}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      <AlertDialog
        isOpen={isJoinDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsJoinDialogOpen(false)}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>
              {t("MultiplayerModal.button.joinRoom")}
            </AlertDialogHeader>
            <AlertDialogBody>
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder={t("MultiplayerModal.field.inviteCode.placeholder")}
              />
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                ref={cancelRef}
                variant="ghost"
                onClick={() => setIsJoinDialogOpen(false)}
              >
                {t("General.cancel")}
              </Button>
              <Button
                colorScheme={primaryColor}
                ml={3}
                isDisabled={joinCode.trim() === ""}
                isLoading={isJoining}
                onClick={handleJoinRoomConfirm}
              >
                {t("General.confirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};

export default MultiplayerModal;

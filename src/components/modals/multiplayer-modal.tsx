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
  ModalFooter,
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
const INVITE_CODE_LENGTH = 6;

type Phase =
  | "checking"
  | "notDownloaded"
  | "ready"
  | "scanning"
  | "roomStarted";

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

  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const phaseRef = useRef<Phase>("checking");
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

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

  const handleInit = useCallback(async () => {
    console.log("[multiplayer] launching terracotta...");
    await MultiplayerService.launchTerracotta().catch((err) =>
      console.error("[multiplayer] launch failed:", err)
    );
    const response = await MultiplayerService.fetchPort();
    if (response.status === "success" && response.data) {
      setPort(response.data);
      console.log("[multiplayer] port:", response.data);
    } else if (response.status === "error") {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
    }
  }, [toast]);

  const checkTerracottaSupport = useCallback(async () => {
    const response = await MultiplayerService.checkTerracotta();
    if (response.status === "success" && response.data) {
      await handleInit();
      setPhase("ready");
    } else {
      setPhase("notDownloaded");
    }
  }, [handleInit]);

  useEffect(() => {
    if (!props.isOpen) return;
    setPhase("checking");
    setPort(0);
    setGeneratedInviteCode("");
    setJoinCode("");
    checkTerracottaSupport();
  }, [checkTerracottaSupport, props.isOpen]);

  useEffect(() => {
    if (!props.isOpen || port === 0) return;
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/state`);
        if (response.ok) {
          const data = await response.json();
          console.log(`[multiplayer] state:`, data);
          if (data.room) {
            setGeneratedInviteCode(data.room);
            if (phaseRef.current === "scanning") {
              setPhase("roomStarted");
            }
          }
        }
      } catch (e) {
        console.error(`[multiplayer] poll error:`, e);
      }
    }, 500);
    return () => clearInterval(intervalId);
  }, [props.isOpen, port]);

  const handleCopyInviteCode = async () => {
    if (!generatedInviteCode) return;
    await copyText(generatedInviteCode, { toast });
  };

  const handleCreateRoom = async () => {
    const url = `http://127.0.0.1:${port}/state/scanning?${selectedPlayer?.name}`;
    console.log(`[multiplayer] create room: ${url}`);
    setPhase("scanning");
    try {
      await fetch(url, { method: "GET" });
    } catch (e) {
      console.error(`[multiplayer] create room error:`, e);
      toast({ title: String(e), status: "error" });
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
    const url = `http://127.0.0.1:${port}/state/guesting?${joinCode.trim()}&${selectedPlayer?.name}`;
    console.log(`[multiplayer] join room: ${url}`);
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        toast({
          title: t("MultiplayerModal.toast.joinReady"),
          status: "success",
        });
      } else {
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
                <Box
                  borderRadius="xl"
                  borderWidth="1px"
                  borderColor={modalBorderColor}
                  bg={panelBg}
                  px={4}
                  py={4}
                >
                  <HStack spacing={3}>
                    <Spinner size="sm" color={`${primaryColor}.500`} />
                    <Text fontSize="sm">
                      {t("MultiplayerModal.status.checking")}
                    </Text>
                  </HStack>
                </Box>
              )}

              {phase === "notDownloaded" && (
                <>
                  <Box
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor={modalBorderColor}
                    bg={panelBg}
                    px={4}
                    py={4}
                  >
                    <Text fontSize="lg" fontWeight="bold">
                      {t("MultiplayerModal.status.notReady")}
                    </Text>
                  </Box>
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
                  <Box
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor={modalBorderColor}
                    bg={panelBg}
                    px={4}
                    py={4}
                  >
                    <Text fontSize="lg" fontWeight="bold">
                      {t("MultiplayerModal.status.ready")}
                    </Text>
                  </Box>
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
                  <Box
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor={modalBorderColor}
                    bg={panelBg}
                    px={4}
                    py={4}
                  >
                    <HStack spacing={3}>
                      <Spinner size="sm" color={`${primaryColor}.500`} />
                      <Text fontSize="sm">
                        {t("MultiplayerModal.runtimeState.host-scanning")}
                      </Text>
                    </HStack>
                  </Box>
                  <Button variant="ghost" onClick={() => setPhase("ready")}>
                    {t("General.exit")}
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
                  <Button variant="ghost" onClick={() => setPhase("ready")}>
                    {t("General.exit")}
                  </Button>
                </>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={props.onClose}>
              {t("General.close")}
            </Button>
          </ModalFooter>
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
                onChange={(e) =>
                  setJoinCode(
                    e.target.value
                      .replace(/\D/g, "")
                      .slice(0, INVITE_CODE_LENGTH)
                  )
                }
                placeholder={t("MultiplayerModal.field.inviteCode.placeholder")}
                inputMode="numeric"
                maxLength={INVITE_CODE_LENGTH}
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
                isDisabled={joinCode.trim().length !== INVITE_CODE_LENGTH}
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

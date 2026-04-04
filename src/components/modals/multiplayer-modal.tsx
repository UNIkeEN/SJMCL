import {
  Box,
  Button,
  ButtonProps,
  FormControl,
  FormHelperText,
  FormLabel,
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
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import { LuCopy, LuDownload, LuHouse, LuUsers } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { MultiplayerService } from "@/services/multiplayer";
import { copyText } from "@/utils/copy";

const TERRACOTTA_ICON_URL =
  "https://zh.minecraft.wiki/images/Red_Glazed_Terracotta_JE1_BE1.png?272a2";
const INVITE_CODE_LENGTH = 6;

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

  const [generatedInviteCode, setGeneratedInviteCode] = useState("");
  const [hasTerracotta, setHasTerracotta] = useState<boolean | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

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

  const checkTerracottaSupport = useCallback(async () => {
    setIsChecking(true);
    const response = await MultiplayerService.checkTerracottaSupport();

    if (response.status === "success") {
      setHasTerracotta(response.data);
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
      setHasTerracotta(false);
    }

    setIsChecking(false);
  }, [toast]);

  useEffect(() => {
    if (!props.isOpen) return;
    setGeneratedInviteCode("");
    setInviteCode("");
    setHasTerracotta(null);
    checkTerracottaSupport();
  }, [checkTerracottaSupport, props.isOpen]);

  const handleCopyInviteCode = async () => {
    if (!generatedInviteCode) return;
    await copyText(generatedInviteCode, { toast });
  };

  const handleCreateRoom = async () => {
    setIsCreatingRoom(true);
    const response = await MultiplayerService.createRoom();

    if (response.status === "success") {
      setGeneratedInviteCode(response.data);
      setInviteCode(response.data);
      toast({
        title: response.message,
        status: "success",
      });
    } else {
      const hasNoOpenInstance = response.raw_error === "NO_OPEN_INSTANCE";

      toast({
        title: hasNoOpenInstance
          ? t("MultiplayerModal.toast.noOpenInstance")
          : response.message,
        description: hasNoOpenInstance ? undefined : response.details,
        status: hasNoOpenInstance ? "warning" : "error",
      });
    }

    setIsCreatingRoom(false);
  };

  const handleDownloadTerracotta = async () => {
    setIsDownloading(true);
    const response = await MultiplayerService.downloadTerracotta();

    if (response.status === "success") {
      toast({
        title: response.message,
        status: "success",
      });
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

  const handleJoinRoom = async () => {
    const normalizedInviteCode = inviteCode.trim();
    if (normalizedInviteCode.length !== INVITE_CODE_LENGTH) return;

    setIsJoiningRoom(true);
    const response = await MultiplayerService.joinRoom(normalizedInviteCode);

    if (response.status === "success") {
      toast({
        title: response.message,
        status: "success",
      });
      props.onClose?.();
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
    }

    setIsJoiningRoom(false);
  };

  return (
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
            <Box
              borderRadius="xl"
              borderWidth="1px"
              borderColor={modalBorderColor}
              bg={panelBg}
              px={4}
              py={4}
            >
              {isChecking || hasTerracotta === null ? (
                <HStack spacing={3}>
                  <Spinner size="sm" color={`${primaryColor}.500`} />
                  <Text fontSize="sm">
                    {t("MultiplayerModal.status.checking")}
                  </Text>
                </HStack>
              ) : (
                <Text fontSize="lg" fontWeight="bold">
                  {t(
                    `MultiplayerModal.status.${hasTerracotta ? "ready" : "notReady"}`
                  )}
                </Text>
              )}
            </Box>

            {hasTerracotta ? (
              <>
                <FormControl>
                  <FormLabel fontSize="sm" mb={2}>
                    {t("MultiplayerModal.field.inviteCode.label")}
                  </FormLabel>
                  <Input
                    value={inviteCode}
                    onChange={(event) =>
                      setInviteCode(
                        event.target.value
                          .replace(/\D/g, "")
                          .slice(0, INVITE_CODE_LENGTH)
                      )
                    }
                    placeholder={t(
                      "MultiplayerModal.field.inviteCode.placeholder"
                    )}
                    inputMode="numeric"
                    maxLength={INVITE_CODE_LENGTH}
                    bg={panelBg}
                    borderColor={modalBorderColor}
                    _hover={{ borderColor: `${primaryColor}.300` }}
                    _focusVisible={{
                      borderColor: `${primaryColor}.400`,
                      boxShadow: `0 0 0 1px var(--chakra-colors-${primaryColor}-400)`,
                    }}
                  />
                  <FormHelperText>
                    {t("MultiplayerModal.field.inviteCode.helper")}
                  </FormHelperText>
                </FormControl>

                {generatedInviteCode && (
                  <Box
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor={modalBorderColor}
                    bg={panelBg}
                    px={4}
                    py={3}
                  >
                    <HStack justify="space-between" spacing={3} align="center">
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

                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={3}>
                  <MultiplayerActionButton
                    icon={LuHouse}
                    imageSrc={TERRACOTTA_ICON_URL}
                    title={t("MultiplayerModal.button.createRoom")}
                    isLoading={isCreatingRoom}
                    onClick={handleCreateRoom}
                  />
                  <MultiplayerActionButton
                    icon={LuUsers}
                    imageSrc={TERRACOTTA_ICON_URL}
                    title={t("MultiplayerModal.button.joinRoom")}
                    isDisabled={inviteCode.trim().length !== INVITE_CODE_LENGTH}
                    isLoading={isJoiningRoom}
                    onClick={handleJoinRoom}
                  />
                </Grid>
              </>
            ) : (
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={3}>
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
                          alt={t("MultiplayerModal.button.thirdPartyChannels")}
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
  );
};

export default MultiplayerModal;

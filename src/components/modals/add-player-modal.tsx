import {
  Button,
  Card,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Icon,
  Input,
  Link,
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
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuChevronDown,
  LuExternalLink,
  LuGrid2X2,
  LuKeyRound,
  LuLink2Off,
  LuPlus,
  LuServer,
  LuSquareUserRound,
} from "react-icons/lu";
import SegmentedControl from "@/components/common/segmented";
import AddAuthServerModal from "@/components/modals/add-auth-server-modal";
import { useLauncherConfig } from "@/contexts/config";
import { useData } from "@/contexts/data";
import { useToast } from "@/contexts/toast";
import { AuthServer } from "@/models/account";
import { InvokeResponse } from "@/models/response";
import { AccountService } from "@/services/account";

interface AddPlayerModalProps extends Omit<ModalProps, "children"> {
  initialPlayerType?: "offline" | "microsoft" | "3rdparty";
  initialAuthServerUrl?: string;
}

const AddPlayerModal: React.FC<AddPlayerModalProps> = ({
  initialPlayerType = "offline",
  initialAuthServerUrl = "",
  ...modalProps
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const { getAuthServerList, getPlayerList, getSelectedPlayer } = useData();
  const [authServerList, setAuthServerList] = useState<AuthServer[]>([]);
  const [playerType, setPlayerType] = useState<
    "offline" | "microsoft" | "3rdparty"
  >("offline");
  const [playername, setPlayername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authServer, setAuthServer] = useState<AuthServer>(); // selected auth server
  const [showOAuth, setShowOAuth] = useState<boolean>(false); // show OAuth button instead of username and password input.
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const initialRef = useRef<HTMLInputElement>(null);

  const {
    isOpen: isAddAuthServerModalOpen,
    onOpen: onAddAuthServerModalOpen,
    onClose: onAddAuthServerModalClose,
  } = useDisclosure();

  useEffect(() => {
    setAuthServerList(getAuthServerList() || []);
  }, [getAuthServerList]);

  useEffect(() => {
    setPlayerType(initialPlayerType);
  }, [initialPlayerType]);

  useEffect(() => {
    let _authServer: AuthServer | undefined = undefined;
    if (initialAuthServerUrl) {
      _authServer = authServerList.find(
        (server) => server.authUrl === initialAuthServerUrl
      );
    } else {
      _authServer = authServerList[0];
    }
    setAuthServer(_authServer);
  }, [initialAuthServerUrl, getAuthServerList, authServerList]);

  useEffect(() => {
    if (
      playerType === "3rdparty" &&
      authServer?.features.openidConfigurationUrl &&
      authServer.clientId
    ) {
      setShowOAuth(true); // if support, first show OAuth
    } else {
      setShowOAuth(false);
    }
  }, [authServer, playerType]);

  useEffect(() => {
    setPassword("");
    initialRef.current?.focus();
  }, [playerType]);

  const isOfflinePlayernameValid = /^[a-zA-Z0-9_]{0,16}$/.test(playername);

  const handleLogin = (isOAuth = false) => {
    let loginServiceFunction: () => Promise<InvokeResponse<void>>;
    if (isOAuth && authServer) {
      loginServiceFunction = () =>
        AccountService.addPlayer3rdPartyOAuth(authServer.authUrl);
    } else if (playerType === "offline") {
      loginServiceFunction = () => AccountService.addPlayerOffline(playername);
    } else if (playerType === "3rdparty" && authServer) {
      loginServiceFunction = () =>
        AccountService.addPlayer3rdPartyPassword(
          authServer.authUrl,
          playername,
          password
        );
    } else {
      return;
    }

    setIsLoading(true);

    loginServiceFunction()
      .then((response) => {
        if (response.status === "success") {
          getPlayerList(true);
          getSelectedPlayer(true);
          toast({
            title: response.message,
            status: "success",
          });
          modalProps.onClose();
        } else {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
      })
      .finally(() => {
        setPlayername("");
        setPassword("");
        setIsLoading(false);
      });
  };

  const playerTypeList = [
    {
      key: "offline",
      icon: LuLink2Off,
      label: t("Enums.playerTypes.offline"),
    },
    {
      key: "microsoft",
      icon: LuGrid2X2,
      label: t("Enums.playerTypes.microsoft"),
    },
    {
      key: "3rdparty",
      icon: LuServer,
      label: t("Enums.playerTypes.3rdpartyShort"),
    },
  ];

  return (
    <Modal
      size={{ base: "md", lg: "lg", xl: "xl" }}
      initialFocusRef={initialRef}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("AddPlayerModal.modal.header")}</ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack spacing={3.5}>
            <FormControl>
              <FormLabel>{t("AddPlayerModal.label.playerType")}</FormLabel>
              <SegmentedControl
                selected={playerType}
                onSelectItem={(s) =>
                  setPlayerType(s as "offline" | "microsoft" | "3rdparty")
                }
                size="sm"
                items={playerTypeList.map((item) => ({
                  value: item.key,
                  label: (
                    <Flex align="center">
                      <Icon as={item.icon} mr={2} />
                      {item.label}
                    </Flex>
                  ),
                }))}
                withTooltip={false}
              />
            </FormControl>

            {playerType === "offline" && (
              <FormControl isRequired isInvalid={!isOfflinePlayernameValid}>
                <FormLabel>
                  {t("AddPlayerModal.offline.playerName.label")}
                </FormLabel>
                <Input
                  placeholder={t(
                    "AddPlayerModal.offline.playerName.placeholder"
                  )}
                  value={playername}
                  onChange={(e) => setPlayername(e.target.value)}
                  required
                  ref={initialRef}
                  focusBorderColor={`${primaryColor}.500`}
                />
                {!isOfflinePlayernameValid && (
                  <FormErrorMessage>
                    {t("AddPlayerModal.offline.playerName.errorMessage")}
                  </FormErrorMessage>
                )}
              </FormControl>
            )}

            {playerType === "microsoft" && (
              <FormControl>{/*TODO*/}</FormControl>
            )}
            {playerType === "3rdparty" && (
              <>
                {authServerList.length === 0 ? (
                  <HStack>
                    <Text>
                      {t("AddPlayerModal.3rdparty.authServer.noSource")}
                    </Text>
                    <Button
                      variant="ghost"
                      colorScheme={primaryColor}
                      onClick={onAddAuthServerModalOpen}
                    >
                      <LuPlus />
                      <Text ml={1}>
                        {t("AddPlayerModal.3rdparty.authServer.addSource")}
                      </Text>
                    </Button>
                  </HStack>
                ) : (
                  <>
                    <FormControl>
                      <FormLabel>
                        {t("AddPlayerModal.3rdparty.authServer.label")}
                      </FormLabel>
                      <HStack>
                        <Menu>
                          <MenuButton
                            as={Button}
                            variant="outline"
                            rightIcon={<LuChevronDown />}
                          >
                            {authServer?.name ||
                              t(
                                "AddPlayerModal.3rdparty.authServer.selectSource"
                              )}
                          </MenuButton>
                          <MenuList>
                            {authServerList.map((server: AuthServer) => (
                              <MenuItem
                                key={server.authUrl}
                                onClick={() => setAuthServer(server)}
                              >
                                {server.name}
                              </MenuItem>
                            ))}
                          </MenuList>
                        </Menu>
                        <Text className="secondary-text ellipsis-text">
                          {authServer?.authUrl}
                        </Text>
                      </HStack>
                    </FormControl>
                    {authServer?.authUrl &&
                      (!showOAuth ? (
                        <>
                          <FormControl isRequired>
                            <FormLabel>
                              {t(
                                `AddPlayerModal.3rdparty.${authServer.features.nonEmailLogin ? "emailOrPlayerName" : "email"}.label`
                              )}
                            </FormLabel>
                            <Input
                              placeholder={t(
                                `AddPlayerModal.3rdparty.${authServer.features.nonEmailLogin ? "emailOrPlayerName" : "email"}.placeholder`
                              )}
                              value={playername}
                              onChange={(e) => setPlayername(e.target.value)}
                              required
                              ref={initialRef}
                              focusBorderColor={`${primaryColor}.500`}
                            />
                          </FormControl>
                          <FormControl isRequired>
                            <FormLabel>
                              {t("AddPlayerModal.3rdparty.password.label")}
                            </FormLabel>
                            <Input
                              placeholder={t(
                                "AddPlayerModal.3rdparty.password.placeholder"
                              )}
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              focusBorderColor={`${primaryColor}.500`}
                            />
                          </FormControl>
                        </>
                      ) : (
                        <Card
                          h="136px" // same as to inputs
                          w="100%"
                          display="flex"
                          flexDirection="column"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <VStack>
                            <Text fontSize="sm">
                              {t(
                                "AddPlayerModal.3rdparty.authServer.supportOAuth"
                              )}
                            </Text>
                            <Button
                              colorScheme={primaryColor}
                              onClick={() => handleLogin(true)}
                              isLoading={isLoading}
                            >
                              {t("AddPlayerModal.button.beginOAuth")}
                            </Button>
                          </VStack>
                        </Card>
                      ))}
                  </>
                )}
              </>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter w="100%">
          {playerType === "offline" && (
            <HStack spacing={2}>
              <LuExternalLink />
              <Link
                color={`${primaryColor}.500`}
                onClick={() => {
                  openUrl(
                    "https://www.microsoft.com/store/productId/9NXP44L49SHJ"
                  );
                }}
              >
                {t("AddPlayerModal.button.buyMinecraft")}
              </Link>
            </HStack>
          )}
          {playerType === "3rdparty" &&
            authServer?.features.openidConfigurationUrl &&
            (showOAuth ? (
              <HStack spacing={2}>
                <LuKeyRound />
                <Button
                  variant="link"
                  colorScheme={primaryColor}
                  onClick={() => {
                    setShowOAuth(false);
                  }}
                >
                  {t("AddPlayerModal.button.usePasswordLogin")}
                </Button>
              </HStack>
            ) : (
              <HStack spacing={2}>
                <LuSquareUserRound />
                <Button
                  variant="link"
                  colorScheme={primaryColor}
                  onClick={() => {
                    setShowOAuth(true);
                  }}
                >
                  {t("AddPlayerModal.button.useOAuthLogin")}
                </Button>
              </HStack>
            ))}
          <HStack spacing={3} ml="auto">
            <Button variant="ghost" onClick={modalProps.onClose}>
              {t("General.cancel")}
            </Button>
            {!showOAuth && (
              <Button
                colorScheme={primaryColor}
                onClick={() => handleLogin()}
                isLoading={isLoading}
                isDisabled={
                  !playername ||
                  (playerType === "offline" && !isOfflinePlayernameValid) ||
                  (playerType === "3rdparty" &&
                    authServerList.length > 0 &&
                    (!authServer || !password))
                }
              >
                {t("General.confirm")}
              </Button>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
      <AddAuthServerModal
        isOpen={isAddAuthServerModalOpen}
        onClose={onAddAuthServerModalClose}
      />
    </Modal>
  );
};

export default AddPlayerModal;

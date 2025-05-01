import {
  Button,
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
import { Section } from "@/components/common/section";
import SegmentedControl from "@/components/common/segmented";
import SelectPlayerModal from "@/components/modals/select-player-modal";
import OAuthLoginPanel from "@/components/oauth-login-panel";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { AuthServer, OAuthCodeResponse, Player } from "@/models/account";
import {
  InvokeResponse,
  ResponseError,
  ResponseSuccess,
} from "@/models/response";
import { AccountService } from "@/services/account";
import { isOfflinePlayernameValid, isUuidValid } from "@/utils/account";

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
  const { config, refreshConfig } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { openSharedModal } = useSharedModals();

  const { getAuthServerList, getPlayerList } = useGlobalData();
  const [authServerList, setAuthServerList] = useState<AuthServer[]>([]);
  const [playerType, setPlayerType] = useState<
    "offline" | "microsoft" | "3rdparty"
  >("offline");
  const [playername, setPlayername] = useState<string>("");
  const [uuid, setUuid] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authServer, setAuthServer] = useState<AuthServer>(); // selected auth server
  const [showOAuth, setShowOAuth] = useState<boolean>(false); // show OAuth button instead of username and password input.
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [oauthCodeResponse, setOAuthCodeResponse] =
    useState<OAuthCodeResponse>();
  const [showAdvancedOptions, setShowAdvancedOptions] =
    useState<boolean>(false);
  const [candidatePlayers, setCandidatePlayers] = useState<Player[]>([]);

  const initialRef = useRef<HTMLInputElement>(null);

  const {
    isOpen: isSelectPlayerModalOpen,
    onOpen: onSelectPlayerModalOpen,
    onClose: onSelectPlayerModalClose,
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
    setShowAdvancedOptions(false);
    setUuid("");
  }, [playerType]);

  useEffect(() => {
    setPlayername("");
    setPassword("");
    setShowAdvancedOptions(false);
    setUuid("");
  }, [modalProps.isOpen]);

  useEffect(() => {
    setOAuthCodeResponse(undefined);
  }, [showOAuth, playerType, modalProps.isOpen]);

  useEffect(() => {
    setCandidatePlayers([]);
  }, [playerType, modalProps.isOpen]);

  useEffect(() => {
    if (candidatePlayers.length) onSelectPlayerModalOpen();
  }, [candidatePlayers, onSelectPlayerModalOpen]);

  const handleFetchOAuthCode = () => {
    if (playerType === "offline") return;
    setOAuthCodeResponse(undefined);
    setIsLoading(true);
    AccountService.fetchOAuthCode(playerType, authServer?.authUrl).then(
      (response) => {
        if (response.status === "success") {
          setOAuthCodeResponse(response.data);
        } else {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
        setIsLoading(false);
      }
    );
  };
  const afterLogin = (response: ResponseSuccess<any>) => {
    Promise.all([getPlayerList(true), refreshConfig()]);
    toast({
      title: response.message,
      status: "success",
    });
    setIsLoading(false);
    modalProps.onClose();
  };

  const afterFailure = (response: ResponseError) => {
    toast({
      title: response.message,
      description: response.details,
      status: "error",
    });
    setIsLoading(false);
  };

  const handleLogin = (isOAuth = false) => {
    if (playerType === "3rdparty" && !isOAuth) {
      if (!authServer) return;

      setIsLoading(true);
      AccountService.addPlayer3rdPartyPassword(
        authServer.authUrl,
        playername,
        password
      ).then((response) => {
        if (response.status === "success") {
          setCandidatePlayers(response.data);

          if (!response.data.length) afterLogin(response);
        } else {
          setPassword("");
          afterFailure(response);
        }
      });
    } else {
      let loginServiceFunction: () => Promise<InvokeResponse<any>>;
      if (playerType === "offline") {
        loginServiceFunction = () =>
          AccountService.addPlayerOffline(
            playername,
            isUuidValid(uuid) ? uuid : undefined
          );
      } else {
        if (!oauthCodeResponse) return;
        loginServiceFunction = () =>
          AccountService.addPlayerOAuth(
            playerType,
            oauthCodeResponse,
            authServer?.authUrl
          );
      }

      setIsLoading(true);

      loginServiceFunction().then((response) => {
        if (response.status === "success") {
          afterLogin(response);
        } else {
          afterFailure(response);
        }
      });
    }
  };

  const handlePlayerSelect = (player: Player) => {
    onSelectPlayerModalClose();
    AccountService.addPlayerFromSelection(player).then((response) => {
      if (response.status === "success") {
        afterLogin(response);
      } else {
        afterFailure(response);
      }
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
              <VStack w="100%" spacing={1}>
                <FormControl
                  isRequired
                  isInvalid={
                    !!playername.length && !isOfflinePlayernameValid(playername)
                  }
                >
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
                  <FormErrorMessage>
                    {t("AddPlayerModal.offline.playerName.errorMessage")}
                  </FormErrorMessage>
                </FormControl>
                <Section
                  isAccordion
                  initialIsOpen={false}
                  title={t("AddPlayerModal.offline.advancedOptions.title")}
                  onAccordionToggle={(isOpen) => setShowAdvancedOptions(isOpen)}
                  w="100%"
                  mt={2}
                  mb={-2}
                />
                {showAdvancedOptions && (
                  <FormControl isInvalid={!!uuid.length && !isUuidValid(uuid)}>
                    <FormLabel>
                      {t("AddPlayerModal.offline.advancedOptions.uuid.label")}
                    </FormLabel>
                    <Input
                      placeholder={t(
                        "AddPlayerModal.offline.advancedOptions.uuid.placeholder"
                      )}
                      value={uuid}
                      onChange={(e) => setUuid(e.target.value)}
                      focusBorderColor={`${primaryColor}.500`}
                    />
                    <FormErrorMessage>
                      {t(
                        "AddPlayerModal.offline.advancedOptions.uuid.errorMessage"
                      )}
                    </FormErrorMessage>
                  </FormControl>
                )}
              </VStack>
            )}

            {playerType === "microsoft" && (
              <OAuthLoginPanel
                authType="microsoft"
                authCode={oauthCodeResponse?.userCode}
                callback={() =>
                  oauthCodeResponse ? handleLogin(true) : handleFetchOAuthCode()
                }
                isLoading={isLoading}
              />
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
                      onClick={() => {
                        openSharedModal("add-auth-server", {});
                      }}
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
                        <OAuthLoginPanel
                          authType="3rdparty"
                          authCode={
                            oauthCodeResponse && oauthCodeResponse.userCode
                          }
                          callback={() =>
                            oauthCodeResponse
                              ? handleLogin(true)
                              : handleFetchOAuthCode()
                          }
                          isLoading={isLoading}
                        />
                      ))}
                  </>
                )}
              </>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter w="100%">
          {(playerType === "offline" || playerType === "microsoft") && (
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
            {!showOAuth && playerType !== "microsoft" && (
              <Button
                colorScheme={primaryColor}
                onClick={() => handleLogin()}
                isLoading={isLoading}
                isDisabled={
                  !playername ||
                  (playerType === "offline" &&
                    !isOfflinePlayernameValid(playername)) ||
                  (uuid && !isUuidValid(uuid)) ||
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
      <SelectPlayerModal
        candidatePlayers={candidatePlayers}
        onPlayerSelected={handlePlayerSelect}
        isOpen={isSelectPlayerModalOpen}
        onClose={onSelectPlayerModalClose}
      />
    </Modal>
  );
};

export default AddPlayerModal;

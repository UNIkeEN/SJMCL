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
  LuLink2Off,
  LuPlus,
  LuServer,
} from "react-icons/lu";
import SegmentedControl from "@/components/common/segmented";
import AddAuthServerModal from "@/components/modals/add-auth-server-modal";
import { useLauncherConfig } from "@/contexts/config";
import { useData } from "@/contexts/data";
import { useToast } from "@/contexts/toast";
import { AuthServer } from "@/models/account";
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
  const { getAuthServerList, getPlayerList, getSelectedPlayer } = useData();
  const [authServerList, setAuthServerList] = useState<AuthServer[]>([]);
  useEffect(() => {
    setAuthServerList(getAuthServerList() || []);
  }, [getAuthServerList]);
  const toast = useToast();
  const [playerType, setPlayerType] = useState<
    "offline" | "microsoft" | "3rdparty"
  >("offline");
  const [playername, setPlayername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authServerUrl, setAuthServerUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const initialRef = useRef(null);

  const {
    isOpen: isAddAuthServerModalOpen,
    onOpen: onAddAuthServerModalOpen,
    onClose: onAddAuthServerModalClose,
  } = useDisclosure();

  useEffect(() => {
    setPlayerType(initialPlayerType);
  }, [initialPlayerType]);

  useEffect(() => {
    setAuthServerUrl(
      initialAuthServerUrl ||
        (authServerList.length > 0 ? authServerList[0].authUrl : "")
    );
  }, [initialAuthServerUrl, getAuthServerList, authServerList]);

  useEffect(() => {
    setPassword("");
  }, [playerType]);

  const isOfflinePlayernameValid = /^[a-zA-Z0-9_]{0,16}$/.test(playername);

  const handleLogin = () => {
    setIsLoading(true);
    AccountService.addPlayer(playerType, playername, password, authServerUrl)
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
                  label: item.key,
                  value: (
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
                <FormLabel>{t("AddPlayerModal.label.playerName")}</FormLabel>
                <Input
                  placeholder={t("AddPlayerModal.placeholder.playerName")}
                  value={playername}
                  onChange={(e) => setPlayername(e.target.value)}
                  required
                  ref={initialRef}
                  focusBorderColor={`${primaryColor}.500`}
                />
                {!isOfflinePlayernameValid && (
                  <FormErrorMessage>
                    {t("AddPlayerModal.errorMessage.playerName")}
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
                    <Text>{t("AddPlayerModal.authServer.noSource")}</Text>
                    <Button
                      variant="ghost"
                      colorScheme={primaryColor}
                      onClick={onAddAuthServerModalOpen}
                    >
                      <LuPlus />
                      <Text ml={1}>
                        {t("AddPlayerModal.authServer.addSource")}
                      </Text>
                    </Button>
                  </HStack>
                ) : (
                  <>
                    <FormControl>
                      <FormLabel>
                        {t("AddPlayerModal.label.authServer")}
                      </FormLabel>
                      <HStack>
                        <Menu>
                          <MenuButton
                            as={Button}
                            variant="outline"
                            rightIcon={<LuChevronDown />}
                          >
                            {authServerList.find(
                              (server) => server?.authUrl === authServerUrl
                            )?.name ||
                              t("AddPlayerModal.authServer.selectSource")}
                          </MenuButton>
                          <MenuList>
                            {authServerList.map((server: AuthServer) => (
                              <MenuItem
                                key={server.authUrl}
                                onClick={() => setAuthServerUrl(server.authUrl)}
                              >
                                {server.name}
                              </MenuItem>
                            ))}
                          </MenuList>
                        </Menu>
                        <Text className="secondary-text ellipsis-text">
                          {authServerUrl}
                        </Text>
                      </HStack>
                    </FormControl>
                    {authServerUrl && (
                      <>
                        <FormControl isRequired>
                          <FormLabel>
                            {t("AddPlayerModal.label.playerName")}
                          </FormLabel>
                          <Input
                            placeholder={t(
                              "AddPlayerModal.placeholder.playerName"
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
                            {t("AddPlayerModal.label.password")}
                          </FormLabel>
                          <Input
                            placeholder={t(
                              "AddPlayerModal.placeholder.password"
                            )}
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            focusBorderColor={`${primaryColor}.500`}
                          />
                        </FormControl>
                      </>
                    )}
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
          <HStack spacing={3} ml="auto">
            <Button variant="ghost" onClick={modalProps.onClose}>
              {t("General.cancel")}
            </Button>
            <Button
              colorScheme={primaryColor}
              onClick={handleLogin}
              isLoading={isLoading}
              isDisabled={
                !playername ||
                (playerType === "offline" && !isOfflinePlayernameValid) ||
                (playerType === "3rdparty" &&
                  authServerList.length > 0 &&
                  (!authServerUrl || !password))
              }
            >
              {t("General.confirm")}
            </Button>
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

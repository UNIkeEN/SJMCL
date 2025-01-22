import {
  Button,
  Flex,
  FormControl,
  FormLabel,
  Icon,
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
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuLink2Off, LuPlus, LuServer } from "react-icons/lu";
import SegmentedControl from "@/components/common/segmented";
import AddAuthServerModal from "@/components/modals/add-auth-server-modal";
import { useLauncherConfig } from "@/contexts/config";
import { useData, useDataDispatch } from "@/contexts/data";
import { useToast } from "@/contexts/toast";
import { AuthServer, PlayerInfo } from "@/models/account";
import { addPlayer, getPlayerList } from "@/services/account";

interface AddPlayerModalProps extends Omit<ModalProps, "children"> {
  initialPlayerType?: "offline" | "3rdparty";
  initialAuthServerUrl?: string;
}

const AddPlayerModal: React.FC<AddPlayerModalProps> = ({
  initialPlayerType = "offline",
  initialAuthServerUrl = "",
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { authServerList } = useData();
  const { setPlayerList } = useDataDispatch();
  const toast = useToast();
  const [playerType, setPlayerType] = useState<"offline" | "3rdparty">(
    "offline"
  );
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
  }, [initialAuthServerUrl, authServerList]);

  useEffect(() => {
    setPassword("");
  }, [playerType]);

  const handleLogin = useCallback(() => {
    let player: PlayerInfo = {
      name: "",
      playerType: playerType,
      password: password,
      uuid: "",
      avatarSrc: "",
      authServerUrl,
    };
    if (playerType === "offline") {
      player.name = playername;
    } else {
      player.authAccount = playername;
    }
    (async () => {
      try {
        setIsLoading(true);
        await addPlayer(player);
        const players = await getPlayerList();
        setPlayerList(players);
        setIsLoading(false);
        toast({
          title: t("Services.account.addPlayer.success"),
          status: "success",
        });
        modalProps.onClose();
      } catch (error) {
        setIsLoading(false);
        toast({
          title: t("Services.account.addPlayer.error"),
          status: "error",
        });
      } finally {
        setPlayername("");
        setPassword("");
      }
    })();
  }, [
    playername,
    playerType,
    password,
    authServerUrl,
    setPlayerList,
    setIsLoading,
    toast,
    t,
    modalProps,
  ]);

  const playerTypeList = [
    {
      key: "offline",
      icon: LuLink2Off,
      label: t("Enums.playerTypes.offline"),
    },
    {
      key: "3rdparty",
      icon: LuServer,
      label: t("Enums.playerTypes.3rdparty"),
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
          <Stack direction="column" spacing={3.5}>
            <FormControl>
              <FormLabel>{t("AddPlayerModal.label.playerType")}</FormLabel>
              <SegmentedControl
                selected={playerType}
                onSelectItem={(s) => setPlayerType(s as "offline" | "3rdparty")}
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

            {playerType === "offline" ? (
              <FormControl isRequired>
                <FormLabel>{t("AddPlayerModal.label.playerName")}</FormLabel>
                <Input
                  placeholder={t("AddPlayerModal.placeholder.playerName")}
                  value={playername}
                  onChange={(e) => setPlayername(e.target.value)}
                  required
                  ref={initialRef}
                  focusBorderColor={`${primaryColor}.500`}
                />
              </FormControl>
            ) : (
              <>
                {authServerList.length === 0 ? (
                  <Stack direction="row" align="center">
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
                  </Stack>
                ) : (
                  <>
                    <FormControl>
                      <FormLabel>
                        {t("AddPlayerModal.label.authServer")}
                      </FormLabel>
                      <Stack direction="row" align="center">
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
                      </Stack>
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
          </Stack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={modalProps.onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            colorScheme={primaryColor}
            onClick={handleLogin}
            isLoading={isLoading}
            isDisabled={
              !playername ||
              (playerType === "3rdparty" &&
                authServerList.length > 0 &&
                (!authServerUrl || !password))
            }
          >
            {t("General.confirm")}
          </Button>
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

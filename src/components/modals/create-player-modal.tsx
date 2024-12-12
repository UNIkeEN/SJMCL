import {
  Button,
  Flex,
  FormControl,
  FormLabel,
  HStack,
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
  Text,
} from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuLink2Off, LuPlus, LuServer } from "react-icons/lu";
import SegmentedControl from "@/components/common/segmented";
import { useLauncherConfig } from "@/contexts/config";
import { useData } from "@/contexts/data";
import { AuthServer } from "@/models/account";

interface CreatePlayerModalProps extends Omit<ModalProps, "children"> {
  initialPlayerType?: string;
  initialAuthServerUrl?: string;
}

const CreatePlayerModal: React.FC<CreatePlayerModalProps> = ({
  initialPlayerType = "offline",
  initialAuthServerUrl = "",
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { authServerList } = useData();
  const [playerType, setPlayerType] = useState<string>(initialPlayerType);
  const [playername, setPlayername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authServerUrl, setAuthServerUrl] = useState<string>(
    initialAuthServerUrl ||
      (authServerList.length > 0 ? authServerList[0].authUrl : "")
  );
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  useEffect(() => {
    setPassword("");
  }, [playerType]);

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
    <Modal {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("CreatePlayerModal.modal.header")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={4}>
            <FormLabel>{t("CreatePlayerModal.label.playerType")}</FormLabel>
            <SegmentedControl
              selected={playerType}
              onSelectItem={(s) => setPlayerType(s)}
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
            <FormControl mb={4} isRequired>
              <FormLabel>{t("CreatePlayerModal.label.playername")}</FormLabel>
              <Input
                placeholder={t("CreatePlayerModal.placeholder.playername")}
                value={playername}
                onChange={(e) => setPlayername(e.target.value)}
                required
              />
            </FormControl>
          ) : (
            <>
              {authServerList.length === 0 ? (
                <HStack mb={4}>
                  <Text>{t("CreatePlayerModal.auth.nodata")}</Text>
                  <Button variant="link" colorScheme={primaryColor}>
                    <LuPlus />
                    <Text ml={1}>{t("CreatePlayerModal.auth.addServer")}</Text>
                  </Button>
                </HStack>
              ) : (
                <>
                  <FormControl mb={4}>
                    <FormLabel>
                      {t("CreatePlayerModal.label.authServer")}
                    </FormLabel>
                    <Menu>
                      <MenuButton
                        as={Button}
                        variant="outline"
                        rightIcon={<LuChevronDown />}
                      >
                        {authServerList.find(
                          (server) => server?.authUrl === authServerUrl
                        )?.name || t("CreatePlayerModal.auth.selectSource")}
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
                  </FormControl>
                  {authServerUrl && (
                    <>
                      <FormControl mb={4} isRequired>
                        <FormLabel>
                          {t("CreatePlayerModal.label.playername")}
                        </FormLabel>
                        <Input
                          placeholder={t(
                            "CreatePlayerModal.placeholder.playername"
                          )}
                          value={playername}
                          onChange={(e) => setPlayername(e.target.value)}
                          required
                        />
                      </FormControl>
                      <FormControl mb={4} isRequired>
                        <FormLabel>
                          {t("CreatePlayerModal.label.password")}
                        </FormLabel>
                        <Input
                          placeholder={t(
                            "CreatePlayerModal.placeholder.password"
                          )}
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </FormControl>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={modalProps.onClose}>
            {t("CreatePlayerModal.modal.cancel")}
          </Button>
          <Button
            colorScheme={primaryColor}
            onClick={modalProps.onClose}
            ml={3}
            isDisabled={
              !playername ||
              (playerType === "3rdparty" &&
                authServerList.length > 0 &&
                (!authServerUrl || !password))
            }
          >
            {t("CreatePlayerModal.modal.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CreatePlayerModal;

import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
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
  Text,
} from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuLink2Off, LuServer } from "react-icons/lu";
import SegmentedControl from "@/components/common/segmented";
import { useData } from "@/contexts/data";
import { AuthServer } from "@/models/account";

interface CreatePlayerModalProps {
  initialSelectedPlayerType?: string;
  isOpen: boolean;
  onClose: () => void;
  addAuthServerPath?: string;
}

const CreatePlayerModal: React.FC<CreatePlayerModalProps> = ({
  initialSelectedPlayerType = "offline",
  isOpen,
  onClose,
  addAuthServerPath = "/auth-servers/add",
}) => {
  const { t } = useTranslation();
  const { authServerList } = useData();
  const [selectedPlayerType, setSelectedPlayerType] = useState<string>(
    initialSelectedPlayerType
  );
  const [playername, setPlayername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authServerName, setAuthServerName] = useState<string>("");

  useEffect(() => {
    setPlayername("");
    setPassword("");
    setAuthServerName("");
  }, [selectedPlayerType]);

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
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("CreatePlayerModal.modal.header")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={4}>
            <FormLabel>{t("CreatePlayerModal.label.playerType")}</FormLabel>
            <SegmentedControl
              selected={selectedPlayerType}
              onSelectItem={(s) => setSelectedPlayerType(s)}
              size="sm"
              items={playerTypeList.map((item) => ({
                ...item,
                label: item.label,
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

          {selectedPlayerType === "offline" ? (
            <FormControl mb={4}>
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
                <Box mb={4}>
                  <Text>
                    {t("CreatePlayerModal.auth.nodata") + " "}
                    <Link color="blue.500" href={addAuthServerPath}>
                      {t("CreatePlayerModal.auth.addServer")}
                    </Link>
                  </Text>
                </Box>
              ) : (
                <>
                  <FormControl mb={4}>
                    <FormLabel>
                      {t("CreatePlayerModal.label.authServer")}
                    </FormLabel>
                    <Menu>
                      <MenuButton as={Button} variant="outline">
                        {authServerName ||
                          t("CreatePlayerModal.auth.selectSource")}
                      </MenuButton>
                      <MenuList>
                        {authServerList.map((server: AuthServer) => (
                          <MenuItem
                            key={server.name}
                            onClick={() => setAuthServerName(server.name)}
                          >
                            {server.name}
                          </MenuItem>
                        ))}
                      </MenuList>
                    </Menu>
                  </FormControl>

                  {/* 角色名和密码输入 */}
                  {authServerName && (
                    <>
                      <FormControl mb={4}>
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
                      <FormControl mb={4}>
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
          <Button variant="ghost" onClick={onClose}>
            {t("CreatePlayerModal.modal.cancel")}
          </Button>
          <Button
            colorScheme="blue"
            onClick={onClose}
            ml={3}
            isDisabled={
              !playername ||
              (selectedPlayerType === "3rdparty" &&
                authServerList.length > 0 &&
                (!authServerName || !password))
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

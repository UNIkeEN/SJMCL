import {
  Button,
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
  Text,
} from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuLink2Off, LuServer } from "react-icons/lu";
import SegmentedControl from "@/components/common/segmented";

export interface AuthServer {
  name: string;
  authUrl: string;
}

export const mockAuthServerList: AuthServer[] = [
  { name: "SJMC 用户中心", authUrl: "https://skin.mc.sjtu.cn/api/yggdrasil" },
  {
    name: "MUA 用户中心",
    authUrl: "https://skin.mualliance.ltd/api/yggdrasil",
  },
];

interface CreateRoleModalProps {
  initialSelectedRole?: string;
  isOpen: boolean;
  onClose: () => void;
}

const CreateRoleModal: React.FC<CreateRoleModalProps> = ({
  initialSelectedRole = "offline",
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<string>(initialSelectedRole);
  const [rolename, setRolename] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authServerName, setAuthServerName] = useState<string>("");
  const [authServers, setAuthServers] =
    useState<AuthServer[]>(mockAuthServerList);

  const roleTypeList = [
    {
      key: "offline",
      icon: LuLink2Off,
      label: t("Enums.roleTypes.offline"),
    },
    {
      key: "3rdparty",
      icon: LuServer,
      label: t("Enums.roleTypes.3rdparty"),
    },
  ];

  // TODO
  const createRoleApi = async (
    roleData: any
  ): Promise<{ success: boolean; message: string }> => {
    return {
      success: true,
      message: t("CreateRoleModal.modal.success"),
    };
  };

  const createRole = async () => {
    if (!rolename) {
      alert(t("CreateRoleModal.error.rolename.required"));
      return;
    }

    let roleData: { name: string; authServerName?: string; password?: string } =
      {
        name: rolename,
      };

    if (selectedRole === "3rdparty") {
      if (!authServerName) {
        alert(t("CreateRoleModal.error.authServer.required"));
        return;
      }
      if (!password) {
        alert(t("CreateRoleModal.error.password.required"));
        return;
      }

      roleData = {
        ...roleData,
        authServerName,
        password,
      };
    }

    try {
      const response = await createRoleApi(roleData);
      if (response.success) {
        onClose();
        alert(t("CreateRoleModal.modal.success"));
      } else {
        alert(response.message);
      }
    } catch (error) {
      console.error(error);
      alert(t("CreateRoleModal.error.general"));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("CreateRoleModal.modal.header")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text mb={2}>{t("CreateRoleModal.roleType.label")}</Text>
          <SegmentedControl
            selected={selectedRole}
            onSelectItem={(s) => setSelectedRole(s)}
            size="sm"
            items={roleTypeList.map((item) => ({
              ...item,
              label: item.label,
              value: (
                <>
                  <Icon as={item.icon} mr={2} />
                  {item.label}
                </>
              ),
            }))}
            withTooltip={false}
          />
          <div style={{ marginTop: "1rem" }}>
            {selectedRole === "offline" ? (
              <Input
                placeholder={t("CreateRoleModal.rolename.placeholder")}
                value={rolename}
                onChange={(e) => setRolename(e.target.value)}
                required
              />
            ) : (
              <>
                <Menu>
                  <MenuButton as={Button} mb={4}>
                    {authServerName || t("CreateRoleModal.auth.selectSource")}
                  </MenuButton>
                  <MenuList>
                    {authServers.map((server) => (
                      <MenuItem
                        key={server.name}
                        onClick={() => setAuthServerName(server.name)}
                      >
                        {server.name}
                      </MenuItem>
                    ))}
                  </MenuList>
                </Menu>
                <Input
                  placeholder={t("CreateRoleModal.rolename.placeholder")}
                  value={rolename}
                  onChange={(e) => setRolename(e.target.value)}
                  required
                />
                <Input
                  placeholder={t("CreateRoleModal.password.placeholder")}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>{t("CreateRoleModal.modal.cancel")}</Button>
          <Button
            colorScheme="blue"
            onClick={createRole}
            ml={3}
            disabled={!rolename}
          >
            {t("CreateRoleModal.modal.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CreateRoleModal;

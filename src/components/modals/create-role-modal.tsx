import {
  Icon,
  Input,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuLink2Off, LuServer } from "react-icons/lu";
import SegmentedControl from "@/components/common/segmented";

interface AuthSource {
  name: string;
}

interface CreateRoleModalProps {
  authSources: AuthSource[];
}

const CreateRoleModal: React.FC<CreateRoleModalProps> = ({
  authSources = [],
}) => {
  const { t } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<string>("offline");
  const [rolename, setRolename] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authSource, setAuthSource] = useState<string>("");

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

  const hasAuthSources = authSources.length > 0;

  return (
    <div>
      <SegmentedControl
        selected={selectedRole}
        onSelectItem={(s) => setSelectedRole(s)}
        size="2xs"
        items={roleTypeList.map((item) => ({
          ...item,
          label: item.key,
          value: <Icon as={item.icon} />,
        }))}
        withTooltip={true}
      />

      <div style={{ marginTop: "1rem" }}>
        {selectedRole === "offline" ? (
          <>
            <Input
              placeholder={t("CreateRoleModal.enterRolename")}
              value={rolename}
              onChange={(e) => setRolename(e.target.value)}
              required
            />
          </>
        ) : (
          <>
            {!hasAuthSources ? (
              <Text>
                {t("CreateRoleModal.noAuthSource")}
                <Link href="/add-auth-source">
                  {t("CreateRoleModal.addAuthSource")}
                </Link>
              </Text>
            ) : (
              <>
                <Menu>
                  <MenuButton
                    as={Input}
                    value={authSource}
                    placeholder={t("CreateRoleModal.selectAuthSource")}
                  />
                  <MenuList>
                    {authSources.map((source) => (
                      <MenuItem
                        key={source.name}
                        onClick={() => setAuthSource(source.name)}
                      >
                        {source.name}
                      </MenuItem>
                    ))}
                  </MenuList>
                </Menu>

                <Input
                  placeholder={t("CreateRoleModal.enterRolename")}
                  value={rolename}
                  onChange={(e) => setRolename(e.target.value)}
                  required
                />
                <Input
                  placeholder={t("CreateRoleModal.enterPassword")}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CreateRoleModal;

import { BoxProps, HStack, Image, Radio, RadioGroup } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { OptionItemGroup } from "@/components/common/option-item";
import { RoleMenuBtnGroup } from "@/components/role-menu";
import { useLauncherConfig } from "@/contexts/config";
import { useData, useDataDispatch } from "@/contexts/data";
import { Role } from "@/models/account";

interface RolesListProps extends BoxProps {
  roles: Role[];
}

const RolesListView: React.FC<RolesListProps> = ({ roles, ...boxProps }) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const { selectedRole } = useData();
  const { setSelectedRole } = useDataDispatch();
  const primaryColor = config.appearance.theme.primaryColor;

  const items = roles.map((role) => ({
    title: role.name,
    description:
      role.type === "offline"
        ? t("Enums.roleTypes.offline")
        : `${t("Enums.roleTypes.3rdparty")} - ${role.authServer?.name} (${role.authAccount})`,
    prefixElement: (
      <HStack spacing={2.5}>
        <Radio
          value={role.uuid}
          onClick={() => setSelectedRole(role)}
          colorScheme={primaryColor}
        />
        <Image
          boxSize="32px"
          objectFit="cover"
          src={role.avatarUrl}
          alt={role.name}
        />
      </HStack>
    ),
    children: <RoleMenuBtnGroup role={role} />,
  }));

  return (
    <RadioGroup value={selectedRole?.uuid}>
      <OptionItemGroup items={items} {...boxProps} />
    </RadioGroup>
  );
};

export default RolesListView;

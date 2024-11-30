import {
  Image,
  Radio,
  RadioGroup,
  BoxProps,
  HStack
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { OptionItemGroup } from "@/components/common/option-item";
import { RoleMenuBtnGroup } from "@/components/role-menu";
import { Role } from "@/models/account";
import { useLauncherConfig } from '@/contexts/config';

interface RolesListProps extends BoxProps {
  roles: Role[];
}

const RolesListView: React.FC<RolesListProps> = ({ roles, ...boxProps }) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const items = roles.map(role => ({
    title: role.name,
    description: role.type === "offline"
      ? t("Enums.roleTypes.offline")
      : `${t("Enums.roleTypes.3rdparty")} - ${role.authServer?.name} (${role.authAccount})`,
      prefixElement: 
        <HStack spacing={2.5}>
          <Radio value={role.uuid} colorScheme={primaryColor}/>
          <Image
            boxSize='32px'
            objectFit='cover'
            src={role.avatarUrl}
            alt={role.name}
          />
        </HStack>,
    children: <RoleMenuBtnGroup role={role}/>
  }));
  
  return (
    <RadioGroup>  {/* TBD: select id and logic from context */}
      <OptionItemGroup 
        items={items}
        {...boxProps}
      />
    </RadioGroup>
  );
};

export default RolesListView;
import {
  Card,
  Wrap,
  WrapItem,
  VStack,
  Text,
  Image,
  Radio,
  RadioGroup,
  IconButton,
  Box,
  BoxProps
} from "@chakra-ui/react";
import { LuMoreHorizontal } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import RoleMenu from "@/components/role-menu";
import { Role } from "@/models/account";
import { useLauncherConfig } from '@/contexts/config';

interface RoleCardProps {
  role: Role;
  isSelected: boolean;
}

interface RolesGridProps extends BoxProps {
  roles: Role[];
}

const RoleCard: React.FC<RoleCardProps> = ({ role, isSelected }) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  return (
    <Card 
      className="content-card" 
      w="10.55rem" 
      borderColor={`${primaryColor}.400`}
      variant={isSelected ? "outline" : "elevated"}
    >
      <Box position="absolute" top={2} left={2}>
        <Radio value={role.uuid} colorScheme={primaryColor}/>
      </Box>
      <Box position="absolute" top={0.5} right={1}>
        <RoleMenu role={role} />
      </Box>
      <VStack spacing={0} >
        <Image
          boxSize='36px'
          objectFit='cover'
          src={role.avatarUrl}
          alt={role.name}
        />
        <Text 
          fontSize="xs-sm" 
          className="no-select"
          fontWeight={isSelected ? "bold" : "normal"}
          mt={2}
        >
          {role.name}
        </Text>
        <Text fontSize="xs" className="secondary-text no-select ellipsis-text">
          {role.type === "offline" ? t("Enums.roleTypes.offline") : role.authServer?.name}
        </Text>
      </VStack>
    </Card>
  );
};

const RolesGridView: React.FC<RolesGridProps> = ({ roles, ...boxProps }) => {
  return (
    <RadioGroup>  {/* TBD: select id and logic from context */}
      <Wrap spacing={3.5} {...boxProps}>
          {roles.map((role, index) => (
            <WrapItem key={role.id}>
              <RoleCard role={role} isSelected={index === 0}/>  {/* TBD: only mock */}
            </WrapItem>
          ))}
      </Wrap>
    </RadioGroup>
  );
};

export default RolesGridView;
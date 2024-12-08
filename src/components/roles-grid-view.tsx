import {
  Box,
  BoxProps,
  Card,
  IconButton,
  Image,
  Radio,
  RadioGroup,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuEllipsis } from "react-icons/lu";
import RoleMenu from "@/components/role-menu";
import { useLauncherConfig } from "@/contexts/config";
import { useData, useDataDispatch } from "@/contexts/data";
import { Role } from "@/models/account";

interface RoleCardProps {
  role: Role;
  isSelected: boolean;
  onSelect: () => void;
}

interface RolesGridProps extends BoxProps {
  roles: Role[];
}

const RoleCard: React.FC<RoleCardProps> = ({ role, isSelected, onSelect }) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  return (
    <Card
      className="content-card"
      w="10.55rem"
      borderColor={`${primaryColor}.500`}
      variant={isSelected ? "outline" : "elevated"}
    >
      <Box position="absolute" top={2} left={2}>
        <Radio
          value={role.uuid}
          colorScheme={primaryColor}
          onClick={onSelect}
        />
      </Box>
      <Box position="absolute" top={0.5} right={1}>
        <RoleMenu role={role} />
      </Box>
      <VStack spacing={0}>
        <Image
          boxSize="36px"
          objectFit="cover"
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
          {role.type === "offline"
            ? t("Enums.roleTypes.offline")
            : role.authServer?.name}
        </Text>
      </VStack>
    </Card>
  );
};

const RolesGridView: React.FC<RolesGridProps> = ({ roles, ...boxProps }) => {
  const { selectedRole } = useData();
  const { setSelectedRole } = useDataDispatch();
  return (
    <RadioGroup value={selectedRole?.uuid}>
      <Wrap spacing={3.5} {...boxProps}>
        {roles.map((role, index) => (
          <WrapItem key={role.id}>
            <RoleCard
              role={role}
              isSelected={selectedRole?.id === role.id}
              onSelect={() => {
                setSelectedRole(role);
              }}
            />{" "}
            {/* TBD: only mock */}
          </WrapItem>
        ))}
      </Wrap>
    </RadioGroup>
  );
};

export default RolesGridView;

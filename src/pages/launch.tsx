import {
  Box,
  Button,
  Card,
  HStack,
  IconButton,
  IconButtonProps,
  Image,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { LuArrowLeftRight } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";
import { useData } from "@/contexts/data";
import styles from "./launch.module.css";

interface SwitchButtonProps extends IconButtonProps {
  tooltip: string;
}

const SwitchButton: React.FC<SwitchButtonProps> = ({ tooltip, ...props }) => {
  return (
    <Tooltip label={tooltip} placement="top-end" fontSize="sm">
      <IconButton
        size="xs"
        position="absolute"
        top={1}
        right={1}
        icon={<LuArrowLeftRight />}
        {...props}
      />
    </Tooltip>
  );
};

const LaunchPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedRole, selectedGameInstance } = useData();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  return (
    <HStack position="absolute" bottom={7} right={7} spacing={4}>
      <Card className={styles["selected-user-card"]}>
        <SwitchButton
          tooltip={t("LaunchPage.SwitchButton.tooltip.switchRole")}
          aria-label="switch-role"
          variant="subtle"
          onClick={() => router.push("/accounts")}
        />
        <HStack spacing={2.5} h="100%" w="100%">
          {selectedRole ? (
            <>
              <Image
                boxSize="32px"
                objectFit="cover"
                src={selectedRole.avatarUrl}
                alt={selectedRole.name}
              />
              <VStack spacing={0} align="left" mt={-2}>
                <Text
                  fontSize="sm"
                  className="no-select"
                  fontWeight="bold"
                  mt={2}
                >
                  {selectedRole.name}
                </Text>
                <Text fontSize="2xs" className="secondary-text no-select">
                  {t(
                    `Enums.roleTypes.${selectedRole.type === "3rdparty" ? "3rdpartyShort" : selectedRole.type}`
                  )}
                </Text>
                <Text fontSize="2xs" className="secondary-text no-select">
                  {selectedRole.type === "3rdparty" &&
                    selectedRole.authServer?.name}
                </Text>
              </VStack>
            </>
          ) : (
            <Text fontSize="sm">尚未登录</Text>
          )}
        </HStack>
      </Card>
      <Box position="relative">
        <Button
          colorScheme={selectedGameInstance ? primaryColor : "blackAlpha"}
          className={styles["launch-button"]}
        >
          <VStack spacing={1.5}>
            <Text fontSize="lg" fontWeight="bold">
              {t("LaunchPage.Button.launch")}
            </Text>
            <Text fontSize="sm">
              {selectedGameInstance
                ? selectedGameInstance.name
                : "尚未选择游戏实例"}
            </Text>{" "}
            {/* TODO: use locales text after finish instance select logic */}
          </VStack>
        </Button>

        <SwitchButton
          tooltip={t("LaunchPage.SwitchButton.tooltip.switchGame")}
          aria-label="switch-game"
          colorScheme="blackAlpha"
          onClick={() => router.push("/games")}
        />
      </Box>
    </HStack>
  );
};

export default LaunchPage;

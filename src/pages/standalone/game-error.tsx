import {
  Alert,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  IconButton,
  Stat,
  StatNumber,
  StatProps,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCircleAlert, LuFolderOpen } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";
import { LaunchService } from "@/services/launch";
import { capitalizeFirstLetter } from "@/utils/string";

const GameErrorPage: React.FC = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [basicInfoParams, setBasicInfoParams] = useState(
    new Map<string, string>()
  );

  const platformName = useCallback(() => {
    let name = config.basicInfo.platform
      .replace("os", "OS")
      .replace("bsd", "BSD");
    return name.includes("OS") ? name : capitalizeFirstLetter(name);
  }, [config.basicInfo.platform]);

  useEffect(() => {
    // construct info maps
    let infoList = new Map<string, string>();
    infoList.set("launcherVersion", config.basicInfo.launcherVersion);
    infoList.set("os", `${platformName()} ${config.basicInfo.platformVersion}`);
    infoList.set("arch", config.basicInfo.arch);
    setBasicInfoParams(infoList);
  }, [config.basicInfo, platformName]);

  const renderStats = ({
    title,
    value,
    helper,
    ...props
  }: {
    title: string;
    value: string;
    helper?: string | React.ReactNode;
  } & StatProps) => {
    return (
      <Stat {...props}>
        <Text fontSize="xs-sm">{title}</Text>
        <StatNumber fontSize="xl">{value}</StatNumber>
        {typeof helper === "string" ? (
          <Text className="secondary-text" fontSize="sm">
            {helper}
          </Text>
        ) : (
          helper
        )}
      </Stat>
    );
  };

  const handleOpenLogWindow = async () => {
    const label = getCurrentWebview()?.label.replace("error", "log");
    console.warn(label);
    if (label) {
      await LaunchService.openGameLogWindow(label);
    }
  };

  return (
    <Flex direction="column" h="100vh">
      <Alert status="error">
        <AlertIcon />
        <AlertTitle fontSize="md">{t("GameErrorPage.title")}</AlertTitle>
      </Alert>
      <Box flex="1" overflowY="auto">
        <VStack align="stretch" spacing={4} p={4} pb={0}>
          <HStack>
            {[...basicInfoParams.entries()].map(([title, value]) =>
              renderStats({
                title: t(`GameErrorPage.basicInfo.${title}`),
                value,
                key: title,
              })
            )}
          </HStack>

          {renderStats({
            title: t("GameErrorPage.gameInfo.gameVersion"),
            value: "1.20.4 + Fabric 0.15.11", // TBD
            helper: (
              <HStack spacing={1}>
                <Text className="secondary-text" fontSize="sm">
                  /mock/path/to/minecraft/
                </Text>
                <Tooltip label={t("General.openFolder")}>
                  <IconButton
                    aria-label={"open"}
                    icon={<LuFolderOpen />}
                    variant="ghost"
                    size="sm"
                    h={21}
                    // onClick={() => {}} TBD
                  />
                </Tooltip>
              </HStack>
            ),
          })}
          {renderStats({
            title: t("GameErrorPage.javaInfo.javaVersion"),
            value: "JDK 21.0.3", // TBD
            helper: (
              <HStack spacing={1}>
                <Text className="secondary-text" fontSize="sm">
                  /mock/path/to/java/
                </Text>
                <Tooltip label={t("General.openFolder")}>
                  <IconButton
                    aria-label={"open"}
                    icon={<LuFolderOpen />}
                    variant="ghost"
                    size="sm"
                    h={21}
                    // onClick={() => {}} TBD
                  />
                </Tooltip>
              </HStack>
            ),
          })}
          <VStack spacing={1} align="stretch">
            <Text fontSize="xs-sm">
              {t("GameErrorPage.crashDetails.title")}
            </Text>
          </VStack>
        </VStack>
      </Box>

      <HStack mt="auto" p={4}>
        <Button colorScheme={primaryColor} variant="solid">
          {t("GameErrorPage.button.exportGameInfo")}
        </Button>
        <Button
          colorScheme={primaryColor}
          variant="solid"
          onClick={handleOpenLogWindow}
        >
          {t("GameErrorPage.button.gameLogs")}
        </Button>
        <Button colorScheme={primaryColor} variant="solid">
          {t("GameErrorPage.button.help")}
        </Button>
        <Icon ml={2} as={LuCircleAlert} color="red.500" />
        <Text fontSize="xs-sm" color="red.500">
          {t("GameErrorPage.bottomAlert")}
        </Text>
      </HStack>
    </Flex>
  );
};

export default GameErrorPage;

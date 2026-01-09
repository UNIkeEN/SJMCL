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
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { save } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCircleAlert, LuFolderOpen } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";
import { InstanceSummary } from "@/models/instance/misc";
import { JavaInfo } from "@/models/system-info";
import { LaunchService } from "@/services/launch";
import { ISOToDatetime } from "@/utils/datetime";
import { parseModernWindowsVersion } from "@/utils/env";
import { analyzeCrashReport } from "@/utils/game-error";
import { capitalizeFirstLetter } from "@/utils/string";
import { parseIdFromWindowLabel } from "@/utils/window";

const GameErrorPage: React.FC = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [basicInfoParams, setBasicInfoParams] = useState(
    new Map<string, string>()
  );
  const [instanceInfo, setInstanceInfo] = useState<InstanceSummary>();
  const [javaInfo, setJavaInfo] = useState<JavaInfo>();
  const [reason, setReason] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

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
    let platform = platformName();
    if (platform === "Linux") {
      infoList.set("os", "Linux");
    } else {
      infoList.set(
        "os",
        `${platform} ${
          platform === "Windows"
            ? parseModernWindowsVersion(config.basicInfo.platformVersion)
            : config.basicInfo.platformVersion
        }`
      );
    }
    infoList.set("arch", config.basicInfo.arch);
    setBasicInfoParams(infoList);
  }, [config.basicInfo, platformName]);

  // set window title with i18n
  useEffect(() => {
    (async () => {
      await getCurrentWebviewWindow().setTitle(
        t("Tauri.windowTitle.gameError")
      );
    })();
  }, [t]);

  // retrieve states and logs (for crash analysis)
  useEffect(() => {
    let launchingId = parseIdFromWindowLabel(getCurrentWebviewWindow().label);

    LaunchService.retrieveGameLaunchingState(launchingId).then((response) => {
      if (response.status === "success") {
        setInstanceInfo(response.data.selectedInstance);
        setJavaInfo(response.data.selectedJava);
      }
    });

    LaunchService.retrieveGameLog(launchingId).then((response) => {
      if (response.status === "success") {
        let { key, params } = analyzeCrashReport(response.data);
        setReason(
          t(`GameErrorPage.crashDetails.${key}`, {
            param1: params[0],
            param2: params[1],
            param3: params[2],
          })
        );
      }
    });
  }, [t]);

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
    let launchingId = parseIdFromWindowLabel(
      getCurrentWebviewWindow()?.label || ""
    );
    if (launchingId) {
      await LaunchService.openGameLogWindow(launchingId);
    }
  };

  const handleExportGameCrashInfo = async () => {
    const timestamp = ISOToDatetime(new Date().toISOString()).replace(
      /[: ]/g,
      "-"
    );

    const savePath = await save({
      defaultPath: `minecraft-exported-crash-info-${timestamp}.zip`,
    });
    let launchingId = parseIdFromWindowLabel(getCurrentWebviewWindow().label);
    if (!savePath || !launchingId) return;
    setIsLoading(true);
    const res = await LaunchService.exportGameCrashInfo(launchingId, savePath);
    if (res.status === "success") {
      await revealItemInDir(res.data);
    }
    setIsLoading(false);
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

          {instanceInfo &&
            renderStats({
              title: t("GameErrorPage.gameInfo.gameVersion"),
              value: instanceInfo.name,
              helper: (
                <HStack spacing={1}>
                  <Text className="secondary-text" fontSize="sm">
                    {instanceInfo.versionPath}
                  </Text>
                  <Tooltip label={t("General.openFolder")}>
                    <IconButton
                      aria-label={"open"}
                      icon={<LuFolderOpen />}
                      variant="ghost"
                      size="sm"
                      h={21}
                      onClick={() => openPath(instanceInfo.versionPath)}
                    />
                  </Tooltip>
                </HStack>
              ),
            })}
          {javaInfo &&
            renderStats({
              title: t("GameErrorPage.javaInfo.javaVersion"),
              value: javaInfo.name,
              helper: (
                <HStack spacing={1}>
                  <Text className="secondary-text" fontSize="sm">
                    {javaInfo.execPath}
                  </Text>
                  <Tooltip label={t("General.openFolder")}>
                    <IconButton
                      aria-label={"open"}
                      icon={<LuFolderOpen />}
                      variant="ghost"
                      size="sm"
                      h={21}
                      onClick={() => revealItemInDir(javaInfo.execPath)}
                    />
                  </Tooltip>
                </HStack>
              ),
            })}
          <VStack spacing={1} align="stretch">
            <Text fontSize="xs-sm">
              {t("GameErrorPage.crashDetails.title")}
            </Text>
            <Text fontSize="md">{reason}</Text>
          </VStack>
        </VStack>
      </Box>

      <HStack mt="auto" p={4}>
        <Button
          colorScheme={primaryColor}
          variant="solid"
          onClick={handleExportGameCrashInfo}
          isLoading={isLoading}
        >
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

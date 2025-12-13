import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Center,
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
import { Badge } from "@chakra-ui/react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { save } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCircleAlert, LuFolderOpen, LuSettings } from "react-icons/lu";
import { LuLightbulb } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import MarkdownContainer from "@/components/common/markdown-container";
import { useLauncherConfig } from "@/contexts/config";
import { useSharedModals } from "@/contexts/shared-modal";
import { InstanceSummary } from "@/models/instance/misc";
import { ChatMessage } from "@/models/intelligence";
import { JavaInfo } from "@/models/system-info";
import { IntelligenceService } from "@/services/intelligence";
import { LaunchService } from "@/services/launch";
import { ISOToDatetime } from "@/utils/datetime";
import { parseModernWindowsVersion } from "@/utils/env";
import { analyzeCrashReport } from "@/utils/game-error";
import { capitalizeFirstLetter } from "@/utils/string";
import { parseIdFromWindowLabel } from "@/utils/window";
import { getLogLevel } from "./game-log";

const GameErrorPage: React.FC = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const { openSharedModal } = useSharedModals();

  const [basicInfoParams, setBasicInfoParams] = useState(
    new Map<string, string>()
  );
  const [instanceInfo, setInstanceInfo] = useState<InstanceSummary>();
  const [javaInfo, setJavaInfo] = useState<JavaInfo>();
  const [reason, setReason] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const [gameLog, setGameLog] = useState<string>("");
  const [aiResult, setAiResult] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [showAIResult, setShowAIResult] = useState<boolean>(false);

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

  useEffect(() => {
    let launchingId = parseIdFromWindowLabel(getCurrentWebview().label);

    LaunchService.retrieveGameLaunchingState(launchingId).then((response) => {
      if (response.status === "success") {
        setInstanceInfo(response.data.selectedInstance);
        setJavaInfo(response.data.selectedJava);
      }
    });

    LaunchService.retrieveGameLog(launchingId).then((response) => {
      if (response.status === "success") {
        const errorLogs = response.data.filter((line) => {
          let level = getLogLevel(line);
          return level == "ERROR" || level == "FATAL";
        });

        const errorLog = errorLogs.join("\n");
        setGameLog(errorLog);

        const { key, params } = analyzeCrashReport(errorLogs); // old analyzer powered by regex
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
    let launchingId = parseIdFromWindowLabel(getCurrentWebview()?.label || "");
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
    let launchingId = parseIdFromWindowLabel(getCurrentWebview().label);
    if (!savePath || !launchingId) return;
    setIsLoading(true);
    const res = await LaunchService.exportGameCrashInfo(launchingId, savePath);
    if (res.status === "success") {
      await revealItemInDir(res.data);
    }
    setIsLoading(false);
  };

  function safeParseAI(content: string): {
    reasons: Array<{ reason: string; fix: string }>;
    raw: string;
    isJSON: boolean;
  } {
    const raw = content ?? "";
    try {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj?.reasons)) {
        return {
          reasons: obj.reasons
            .map((x: any) => ({
              reason: String(x?.reason ?? "").trim(),
              fix: String(x?.fix ?? "").trim(),
            }))
            .filter((x: { reason: any; fix: any }) => x.reason || x.fix),
          raw,
          isJSON: true,
        };
      }
    } catch {}

    const m = raw.match(/```[\w-]*\s*([\s\S]*?)\s*```/i);
    if (m) {
      try {
        const obj2 = JSON.parse(m[1]);
        if (Array.isArray(obj2?.reasons)) {
          return {
            reasons: obj2.reasons
              .map((x: any) => ({
                reason: String(x?.reason ?? "").trim(),
                fix: String(x?.fix ?? "").trim(),
              }))
              .filter((x: { reason: any; fix: any }) => x.reason || x.fix),
            raw,
            isJSON: true,
          };
        }
      } catch {}
    }

    return { reasons: [], raw, isJSON: false };
  }

  async function callAIAnalyze(log: string) {
    setShowAIResult(true);
    if (!config.intelligence.enabled) {
      openSharedModal("ai-provider-settings");
      return;
    }

    setAiLoading(true);
    setAiResult("");

    let messages: ChatMessage[] = [
      {
        role: "system",
        content: t("GameErrorPage.aiAnalysis.systemPrompt"),
      },
      {
        role: "user",
        content: t("GameErrorPage.aiAnalysis.userPrompt", {
          os: basicInfoParams.get("os") ?? t("General.unknown"),
          javaVersion: javaInfo?.name ?? t("General.unknown"),
          mcVersion: instanceInfo?.name ?? t("General.unknown"),
          log,
        }),
      },
    ];

    const resp = await IntelligenceService.fetchLLMChatResponse(messages);
    if (resp.status === "success") {
      setAiResult(resp.data);
    } else {
      setAiResult(resp.message + ": " + resp.details);
    }
    setAiLoading(false);
  }

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
            <HStack align="center">
              <Text fontSize="xs-sm">
                {!showAIResult
                  ? t("GameErrorPage.crashDetails.title")
                  : t("GameErrorPage.aiAnalysis.title")}
              </Text>
              {showAIResult && (
                <Badge size="xs" colorScheme="purple">
                  BETA
                </Badge>
              )}
            </HStack>
            {!showAIResult ? (
              <Text fontSize="md">{reason}</Text>
            ) : (
              <>
                {aiLoading ? (
                  <Center>
                    <BeatLoader size={16} color="gray" />
                  </Center>
                ) : (
                  (() => {
                    const parsed = safeParseAI(aiResult);

                    return (
                      <>
                        {parsed.reasons.length > 0 ? (
                          parsed.reasons.map((item, i) => (
                            <Alert key={i} status="info" borderRadius="md">
                              <AlertIcon as={LuLightbulb} />
                              <VStack spacing={0} align="start">
                                <AlertTitle>{item.reason}</AlertTitle>
                                <AlertDescription>
                                  <MarkdownContainer>
                                    {item.fix}
                                  </MarkdownContainer>
                                </AlertDescription>
                              </VStack>
                            </Alert>
                          ))
                        ) : (
                          <>
                            <Text fontSize="sm" color="gray.500">
                              {t(
                                "GameErrorPage.aiAnalysis.structureNotProcessed"
                              )}
                            </Text>
                            <Alert status="info" borderRadius="md">
                              <AlertDescription>
                                <MarkdownContainer>
                                  {parsed.raw}
                                </MarkdownContainer>
                              </AlertDescription>
                            </Alert>
                          </>
                        )}
                      </>
                    );
                  })()
                )}
              </>
            )}
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

        <Button
          colorScheme={primaryColor}
          variant="solid"
          onClick={() => callAIAnalyze(gameLog)}
          isLoading={aiLoading}
        >
          {t("GameErrorPage.button.aiAnalysis")}
        </Button>

        <Button
          variant="solid"
          onClick={() => openSharedModal("ai-provider-settings")}
        >
          <Icon as={LuSettings} />
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

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
import { save } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCircleAlert, LuFolderOpen, LuSettings } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import AddAIProviderModal, {
  loadAIProvider,
} from "@/components/modals/add-ai-provider-modal";
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

  // 新增：原始日志、AI 分析结果、AI 调用状态、设置 Modal 开关
  const [gameLog, setGameLog] = useState<string>("");
  const [aiResult, setAiResult] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [isAIProviderModalOpen, setAIProviderModalOpen] =
    useState<boolean>(false);
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
        console.log(response.data);
        setInstanceInfo(response.data.selectedInstance);
        setJavaInfo(response.data.selectedJava);
      }
    });

    LaunchService.retrieveGameLog(launchingId).then((response) => {
      if (response.status === "success") {
        // 标准化为 string[]（供分析）
        const rawLines: string[] = Array.isArray(response.data)
          ? response.data
          : response.data
            ? String(response.data).split(/\r?\n/)
            : [];

        // 合并为 string（供展示）
        const raw = rawLines.join("\n");
        setGameLog(raw);

        const { key, params } = analyzeCrashReport(rawLines);
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

  // —— 新增：调用 AI（OpenAI 兼容接口）——
  async function callAIAnalyze(log: string) {
    setShowAIResult(true);
    // 读取本地配置
    const provider = loadAIProvider();
    if (!provider) {
      setAIProviderModalOpen(true);
      return;
    }
    const { baseURL, apiKey, model } = provider;

    const prompt = `请分析以下Minecraft日志，给出主要错误原因、其他原因和建议，并在给出快速解决方案，快速解决方案尽量简短，错误原因尽量详细：\n${log}`;

    setAiLoading(true);
    setAiResult("");

    try {
      // 兼容 OpenAI 风格 /v1/chat/completions
      const resp = await fetch(
        `${baseURL.replace(/\/+$/, "")}/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: "你是精通 Minecraft 启动与崩溃问题的技术助手。",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.2,
          }),
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text}`);
      }
      const data = await resp.json();

      // 兼容常见字段
      const content =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        JSON.stringify(data);
      setAiResult(content || "（AI 未返回内容）");
    } catch (e: any) {
      setAiResult(`调用 AI 失败：${String(e?.message ?? e)}`);
    } finally {
      setAiLoading(false);
    }
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

          {/* 原崩溃详情 */}
          <VStack spacing={1} align="stretch">
            <Text fontSize="xs-sm">
              {t("GameErrorPage.crashDetails.title")}
            </Text>
            <Text fontSize="md">{reason}</Text>
          </VStack>

          {showAIResult && (
            <VStack spacing={1} align="stretch">
              <Text fontSize="xs-sm">AI分析结果</Text>
              {aiLoading ? (
                <BeatLoader size={6} color="grey" />
              ) : (
                <Text fontSize="md" whiteSpace="pre-wrap">
                  {aiResult}
                </Text>
              )}
            </VStack>
          )}
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

        {/* —— 新增：“AI Log 分析”触发 —— */}
        <Button
          colorScheme={primaryColor}
          variant="solid"
          onClick={() => callAIAnalyze(gameLog)}
          isLoading={aiLoading}
          loadingText="分析中"
        >
          AI Log 分析
        </Button>

        {/* —— 齿轮：打开 AI Provider Modal —— */}
        <Button variant="solid" onClick={() => setAIProviderModalOpen(true)}>
          <Icon as={LuSettings} />
        </Button>

        <Icon ml={2} as={LuCircleAlert} color="red.500" />
        <Text fontSize="xs-sm" color="red.500">
          {t("GameErrorPage.bottomAlert")}
        </Text>
      </HStack>

      {/* —— 新增：AI 供应商配置 Modal —— */}
      <AddAIProviderModal
        isOpen={isAIProviderModalOpen}
        onClose={() => setAIProviderModalOpen(false)}
      />
    </Flex>
  );
};

export default GameErrorPage;

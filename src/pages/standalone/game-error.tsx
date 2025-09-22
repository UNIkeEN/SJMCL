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
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Divider,
  List,
  ListIcon,
  ListItem,
} from "@chakra-ui/react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { save } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCircleAlert, LuFolderOpen, LuSettings } from "react-icons/lu";
import {
  LuBot,
  LuClipboardList,
  LuFileText,
  LuLightbulb,
} from "react-icons/lu";
import ReactMarkdown from "react-markdown";
import { BeatLoader } from "react-spinners";
import remarkGfm from "remark-gfm";
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
        const rawLines: string[] = Array.isArray(response.data)
          ? response.data
          : response.data
            ? String(response.data).split(/\r?\n/)
            : [];

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

  function safeParseAI(content: string): {
    primary: Array<{ reason: string; fix: string }>;
    others_md: string;
    raw: string;
    isJSON: boolean;
  } {
    const raw = content ?? "";
    try {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj?.primary)) {
        return {
          primary: obj.primary
            .map((x: any) => ({
              reason: String(x?.reason ?? "").trim(),
              fix: String(x?.fix ?? "").trim(),
            }))
            .filter((x: { reason: any; fix: any }) => x.reason || x.fix),
          others_md: String(obj?.others_md ?? "").trim(),
          raw,
          isJSON: true,
        };
      }
    } catch {}

    const m = raw.match(/```json\s*([\s\S]*?)\s*```/i);
    if (m) {
      try {
        const obj2 = JSON.parse(m[1]);
        if (Array.isArray(obj2?.primary)) {
          return {
            primary: obj2.primary
              .map((x: any) => ({
                reason: String(x?.reason ?? "").trim(),
                fix: String(x?.fix ?? "").trim(),
              }))
              .filter((x: { reason: any; fix: any }) => x.reason || x.fix),
            others_md: String(obj2?.others_md ?? "").trim(),
            raw,
            isJSON: true,
          };
        }
      } catch {}
    }

    return { primary: [], others_md: raw, raw, isJSON: false };
  }

  async function callAIAnalyze(log: string) {
    setShowAIResult(true);
    const provider = loadAIProvider();
    if (!provider) {
      setAIProviderModalOpen(true);
      return;
    }
    const { baseURL, apiKey, model } = provider;

    const prompt = `
    你是 Minecraft 启动/崩溃诊断专家。请只按以下 JSON 模式输出，不要任何开头/结尾客套话、不要解释。

    {
      "primary": [            // 主要原因与解决方案（每条尽量短）
        { "reason": "一句话原因", "fix": "一句话解决方案" }
      ],
     "others_md": "这里是较长说明，使用 Markdown 列表/小标题即可，可包含若干可能原因、定位思路、命令/路径等"
    }

    要求：
    - 严禁输出 JSON 以外的内容。
    - "primary" 2~5 条，每条各自 1 句中文（不超过30字）。
    - "others_md" 可多段 Markdown，允许列表/代码块/链接。
    - 聚焦本次日志，不要泛泛而谈。

    以下是原始日志（可能很长）：
    ${log}
    `.trim();

    setAiLoading(true);
    setAiResult("");

    try {
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

          <VStack spacing={1} align="stretch">
            <Text fontSize="xs-sm">
              {t("GameErrorPage.crashDetails.title")}
            </Text>
            <Text fontSize="md">{reason}</Text>
          </VStack>

          {showAIResult && (
            <Card variant="outline" borderRadius="2xl" overflow="hidden">
              <CardHeader pb={2}>
                <HStack justify="space-between">
                  <HStack>
                    <Icon as={LuBot} />
                    <Text fontSize="sm" fontWeight="bold">
                      AI 分析结果
                    </Text>
                    <Badge colorScheme="purple" variant="subtle">
                      BETA
                    </Badge>
                  </HStack>
                  {aiLoading && <BeatLoader size={6} />}
                </HStack>
              </CardHeader>

              <Divider />

              <CardBody>
                {aiLoading ? (
                  <Text fontSize="sm" color="gray.500">
                    正在分析日志，请稍候…
                  </Text>
                ) : (
                  (() => {
                    const parsed = safeParseAI(aiResult);

                    return (
                      <VStack align="stretch" spacing={5}>
                        <Box>
                          <HStack mb={2}>
                            <Icon as={LuLightbulb} />
                            <Text fontSize="sm" fontWeight="semibold">
                              主要原因与解决方案
                            </Text>
                          </HStack>

                          {parsed.primary.length > 0 ? (
                            <List spacing={1}>
                              {parsed.primary.map((item, i) => (
                                <ListItem key={i}>
                                  <ListIcon as={LuClipboardList} />
                                  <Text as="span" fontSize="sm">
                                    {item.reason && (
                                      <>
                                        <b>原因：</b>
                                        {item.reason}；
                                      </>
                                    )}
                                    {item.fix && (
                                      <>
                                        <b>方案：</b>
                                        {item.fix}
                                      </>
                                    )}
                                  </Text>
                                </ListItem>
                              ))}
                            </List>
                          ) : (
                            <Text fontSize="sm" color="gray.500">
                              未检测到结构化“主要原因”，已在下方给出完整
                              Markdown。
                            </Text>
                          )}
                        </Box>

                        <Accordion allowToggle>
                          <AccordionItem border="none">
                            <AccordionButton px={0}>
                              <HStack flex="1" textAlign="left">
                                <Icon as={LuFileText} />
                                <Text fontSize="sm" fontWeight="semibold">
                                  其他可能原因
                                </Text>
                              </HStack>
                              <AccordionIcon />
                            </AccordionButton>
                            <AccordionPanel px={0} pt={3}>
                              <Box className="prose" fontSize="sm">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {parsed.others_md || parsed.raw || "（空）"}
                                </ReactMarkdown>
                              </Box>
                            </AccordionPanel>
                          </AccordionItem>
                        </Accordion>

                        {!parsed.isJSON && (
                          <Box>
                            <Divider my={3} />
                            <Text fontSize="xs" color="gray.500">
                              模型未按 JSON 返回，以下为原始 Markdown：
                            </Text>
                            <Box mt={2} className="prose" fontSize="sm">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {parsed.raw}
                              </ReactMarkdown>
                            </Box>
                          </Box>
                        )}
                      </VStack>
                    );
                  })()
                )}
              </CardBody>
            </Card>
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

        <Button
          colorScheme={primaryColor}
          variant="solid"
          onClick={() => callAIAnalyze(gameLog)}
          isLoading={aiLoading}
          loadingText="分析中"
        >
          AI Log 分析
        </Button>

        <Button variant="solid" onClick={() => setAIProviderModalOpen(true)}>
          <Icon as={LuSettings} />
        </Button>

        <Icon ml={2} as={LuCircleAlert} color="red.500" />
        <Text fontSize="xs-sm" color="red.500">
          {t("GameErrorPage.bottomAlert")}
        </Text>
      </HStack>

      <AddAIProviderModal
        isOpen={isAIProviderModalOpen}
        onClose={() => setAIProviderModalOpen(false)}
      />
    </Flex>
  );
};

export default GameErrorPage;

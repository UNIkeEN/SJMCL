import {
  Box,
  Flex,
  HStack,
  IconButton,
  Image,
  Spinner,
  Text,
  Textarea,
  VStack,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuHistory,
  LuPause,
  LuPlus,
  LuSend,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import MarkdownContainer from "@/components/common/markdown-container";
import { OptionItem } from "@/components/common/option-item";
import { MiuChatLogoTitle } from "@/components/logo-title";
import { useLauncherConfig } from "@/contexts/config";
import { useFunctionCallActions } from "@/contexts/function-call";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { GetStateFlag } from "@/hooks/get-state";
import { ChatMessage, ChatSessionSummary } from "@/models/intelligence";
import { NewsPostRequest } from "@/models/news-post";
import { getChatSystemPrompt } from "@/prompts";
import { ConfigService } from "@/services/config";
import { DiscoverService } from "@/services/discover";
import { InstanceService } from "@/services/instance";
import { IntelligenceService } from "@/services/intelligence";
import { ResourceService } from "@/services/resource";
import { FunctionCallMatch, findFunctionCalls } from "@/utils/function-call";
import { base64ImgSrc, formatPrintable } from "@/utils/string";
import AdvancedCard from "./common/advanced-card";
import { gameTypesToIcon } from "./game-version-selector";

const AGENT_AVATAR_SRC = "/images/agent/miuxi_px_avatar.png";

interface AgentChatProps {
  onAgentChatPanelClose: () => void;
}

const AgentChat: React.FC<AgentChatProps> = ({ onAgentChatPanelClose }) => {
  const { t, i18n } = useTranslation();
  const { config } = useLauncherConfig();
  const { selectedPlayer, getGameVersionList } = useGlobalData();
  const primaryColor = config.appearance.theme.primaryColor;

  // Initialize with system prompt
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: "system",
      content: getChatSystemPrompt(i18n.language),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const currentSessionIdRef = useRef<string>(crypto.randomUUID());
  const sessionCreatedAtRef = useRef<number>(Math.floor(Date.now() / 1000));
  const wasLoadingRef = useRef(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const toast = useToast();
  const { openSharedModal } = useSharedModals();
  const { getCallState, setCallState, hasExecutingCall } =
    useFunctionCallActions();

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const saveCurrentSession = async () => {
    const msgs = messagesRef.current;
    const userMsgs = msgs.filter((m) => m.role === "user");
    if (userMsgs.length === 0) return;
    const title = userMsgs[0].content.slice(0, 50);
    await IntelligenceService.saveChatSession({
      id: currentSessionIdRef.current,
      title,
      messages: msgs,
      createdAt: sessionCreatedAtRef.current,
      updatedAt: Math.floor(Date.now() / 1000),
    });
  };

  const handleNewSession = async () => {
    await saveCurrentSession();
    requestIdRef.current++;
    currentSessionIdRef.current = crypto.randomUUID();
    sessionCreatedAtRef.current = Math.floor(Date.now() / 1000);
    setIsLoading(false);
    setMessages([
      { role: "system", content: getChatSystemPrompt(i18n.language) },
    ]);
    setInput("");
    setShowHistory(false);
  };

  useEffect(() => {
    console.log(messages);
  }, [messages]);

  const handleShowHistory = async () => {
    const resp = await IntelligenceService.retrieveChatSessions();
    if (resp.status === "success") {
      setSessions(resp.data);
    }
    setShowHistory(true);
  };

  const handleLoadSession = async (sessionId: string) => {
    const resp = await IntelligenceService.retrieveChatSession(sessionId);
    if (resp.status === "success") {
      currentSessionIdRef.current = sessionId;
      sessionCreatedAtRef.current = resp.data.createdAt;
      setMessages(resp.data.messages);
      setShowHistory(false);
      setInput("");
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    await IntelligenceService.deleteChatSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      saveCurrentSession();
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!config.intelligence.enabled) {
      // TODO: toast error or show modal
      return;
    }

    const userMsg: ChatMessage = { role: "user", content: input };
    // Include current conversation history plus the new message
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const currentRequestId = ++requestIdRef.current;

    // Initial empty assistant message placeholder
    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    let currentResponse = "";

    try {
      // System prompt is already in messages[0]
      await IntelligenceService.fetchLLMChatResponse(newMessages, (chunk) => {
        if (requestIdRef.current !== currentRequestId) return;
        currentResponse += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          // Update the last message (which is the assistant's)
          if (updated.length > 0) {
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: currentResponse,
            };
          }
          return updated;
        });
      });

      // Some providers may not emit stream chunks. Fallback to non-stream response.
      if (!currentResponse.trim()) {
        const fallbackResp =
          await IntelligenceService.fetchLLMChatResponse(newMessages);
        if (
          requestIdRef.current === currentRequestId &&
          fallbackResp.status === "success"
        ) {
          currentResponse = fallbackResp.data || "";
          setMessages((prev) => {
            const updated = [...prev];
            if (updated.length > 0) {
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: currentResponse,
              };
            }
            return updated;
          });
        }
      }
    } catch (error) {
      if (requestIdRef.current !== currentRequestId) return;
      console.error(error);
      setMessages((prev) => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content:
              currentResponse +
              "\n\n**Error:** An error occurred while fetching the response.",
          };
        }
        return updated;
      });
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setIsLoading(false);
      }
    }
  };

  const handleStopReply = () => {
    // Cancel current streaming updates by invalidating the request ID
    requestIdRef.current++;
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const executeFunctionCall = async (
    name: string,
    params: Record<string, any>
  ) => {
    switch (name) {
      case "retrieve_game_version_list":
        if (
          !params.type ||
          !["release", "snapshot", "old_beta", "april_fools"].includes(
            params.type
          )
        ) {
          return { status: "error", message: "Missing or incorrect type" };
        }
        let versionList = await getGameVersionList();
        if (versionList == GetStateFlag.Cancelled) {
          return { status: "error", message: "Cancelled" };
        }
        return (versionList || []).filter((v) => v.gameType === params.type);
      case "retrieve_mod_loader_list_by_game_version":
        if (
          !params.version ||
          !["Fabric", "Forge", "NeoForge"].includes(params.loaderType)
        ) {
          return {
            status: "error",
            message: "Missing version or incorrect loaderType",
          };
        }
        return await ResourceService.fetchModLoaderVersionList(
          params.version,
          params.loaderType
        );
      case "create_instance":
        if (
          !params.name ||
          !params.description ||
          !params.gameInfo ||
          !params.modLoaderInfo
        ) {
          return {
            status: "error",
            message: "Missing name, description, gameInfo or modLoaderInfo",
          };
        }
        return await InstanceService.createInstance(
          config.localGameDirectories[0],
          params.name,
          params.description,
          gameTypesToIcon[params.gameInfo.gameType],
          params.gameInfo,
          params.modLoaderInfo,
          undefined,
          true
        );
      case "retrieve_instance_list":
        return await InstanceService.retrieveInstanceList();
      case "retrieve_instance_game_config":
        if (!params.id) {
          return { status: "error", message: "Missing instanceId" };
        }
        return await InstanceService.retrieveInstanceGameConfig(params.id);
      case "retrieve_instance_world_list":
        if (!params.id) {
          return { status: "error", message: "Missing instanceId" };
        }
        return await InstanceService.retrieveWorldList(params.id);
      case "retrieve_instance_world_details":
        if (!params.instanceId || !params.worldName) {
          return {
            status: "error",
            message: "Missing instanceId or worldName",
          };
        }
        return await InstanceService.retrieveWorldDetails(
          params.instanceId,
          params.worldName
        );
      case "retrieve_instance_game_server_list":
        return await InstanceService.retrieveGameServerList(params.id, true);
      case "retrieve_instance_local_mod_list":
        let local_mod_list_response =
          await InstanceService.retrieveLocalModList(params.id);
        if (local_mod_list_response.status === "success") {
          return local_mod_list_response.data.map((mod) => {
            return { ...mod, iconSrc: undefined }; // iconSrc is too large and useless
          });
        }
        return local_mod_list_response;
      case "retrieve_instance_resource_pack_list":
        let resource_pack_list_response =
          await InstanceService.retrieveResourcePackList(params.id);
        if (resource_pack_list_response.status === "success") {
          return resource_pack_list_response.data.map((pack) => {
            return { ...pack, iconSrc: undefined };
          });
        }
        return resource_pack_list_response;
      case "retrieve_instance_server_resource_pack_list":
        let server_resource_pack_list_response =
          await InstanceService.retrieveServerResourcePackList(params.id);
        if (server_resource_pack_list_response.status === "success") {
          return server_resource_pack_list_response.data.map((pack) => {
            return { ...pack, iconSrc: undefined };
          });
        }
        return server_resource_pack_list_response;
      case "retrieve_instance_schematic_list":
        return await InstanceService.retrieveSchematicList(params.id);
      case "retrieve_instance_shader_pack_list":
        return await InstanceService.retrieveShaderPackList(params.id);
      case "launch_instance":
        let instance_list_response =
          await InstanceService.retrieveInstanceList();
        if (instance_list_response.status !== "success") {
          return {
            message: t("AgentChatPage.functionCall.launchInstance.fail"),
          };
        }
        let instance = instance_list_response.data.find(
          (instance) => instance.id === params.id
        );
        if (!instance) {
          return {
            message: t("AgentChatPage.functionCall.launchInstance.fail"),
          };
        } else {
          openSharedModal("launch", {
            instanceId: params.id,
          });
          return {
            message: t("AgentChatPage.functionCall.launchInstance.success"),
          };
        }
      case "retrieve_launcher_config":
        return config;
      case "retrieve_java_info":
        return await ConfigService.retrieveJavaList();
      case "fetch_news":
        const sources: NewsPostRequest[] = config.discoverSourceEndpoints.map(
          (url) => ({
            url,
            cursor: null,
          })
        );
        return await DiscoverService.fetchNewsPostSummaries(sources);
      default:
        return `Unknown function: ${name}`;
    }
  };

  const handleFunctionCall = React.useCallback(
    async (param: {
      name: string;
      params: Record<string, any>;
      callId?: string;
    }) => {
      const { name, params, callId } = param;

      // If callId is present, check if already executed/executing
      if (callId) {
        const state = getCallState(callId);
        if (state.isExecuting || state.result || state.error) {
          return;
        }
        setCallState(callId, {
          isExecuting: true,
          result: null,
          error: null,
        });
      }

      let result = "";
      try {
        result = formatPrintable(await executeFunctionCall(name, params));
        if (callId) {
          setCallState(callId, {
            isExecuting: false,
            result: result,
            error: null,
          });
        }
      } catch (e: any) {
        result = `Error: ${e.message || "Unknown error"}`;
        if (callId) {
          setCallState(callId, {
            isExecuting: false,
            result: null,
            error: result,
          });
        }
      }

      const systemMsg = { role: "system", content: result } as ChatMessage;
      const assistantMsg = { role: "assistant", content: "" } as ChatMessage;

      const currentRequestId = ++requestIdRef.current;

      // ATOMIC UPDATE: Add system message and placeholder together to prevent race conditions
      setMessages((prev) => [...prev, systemMsg, assistantMsg]);
      setIsLoading(true);

      const newHistory = [...messagesRef.current, systemMsg];

      try {
        let currentResponse = "";

        // Fetch response based on new history which includes the system result
        await IntelligenceService.fetchLLMChatResponse(newHistory, (chunk) => {
          if (requestIdRef.current !== currentRequestId) return;
          currentResponse += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            // Update the last message (which is the new assistant message)
            if (updated.length > 0) {
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: currentResponse,
              };
            }
            return updated;
          });
        });

        // Some providers may not emit stream chunks. Fallback to non-stream response.
        if (!currentResponse.trim()) {
          const fallbackResp =
            await IntelligenceService.fetchLLMChatResponse(newHistory);
          if (
            requestIdRef.current === currentRequestId &&
            fallbackResp.status === "success"
          ) {
            currentResponse = fallbackResp.data || "";
            setMessages((prev) => {
              const updated = [...prev];
              if (updated.length > 0) {
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: currentResponse,
                };
              }
              return updated;
            });
          }
        }
      } catch (e) {
        if (requestIdRef.current !== currentRequestId) return;
        console.error(e);
        toast({ title: "Error fetching response", status: "error" });
        setMessages((prev) => {
          const updated = [...prev];
          if (
            updated.length > 0 &&
            updated[updated.length - 1].content === ""
          ) {
            updated[updated.length - 1].content =
              "**Error:** Execution failed.";
          }
          return updated;
        });
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsLoading(false);
        }
      }
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language, toast, getCallState, setCallState]
  );

  // Auto-execute function calls when response is finished
  useEffect(() => {
    if (isLoading || messages.length === 0) return;
    const lastMsgIndex = messages.length - 1;
    const lastMsg = messages[lastMsgIndex];

    if (lastMsg.role === "assistant") {
      const matches = findFunctionCalls(lastMsg.content);
      const validMatches = matches.filter(
        (m) => m.type === "success"
      ) as FunctionCallMatch[];

      if (validMatches.length > 0) {
        const lastMatch = validMatches[validMatches.length - 1];
        // Check context if already executed
        const state = getCallState(
          `${currentSessionIdRef.current}-${lastMsgIndex}`
        );
        if (!state.result && !state.error && !state.isExecuting) {
          handleFunctionCall({
            name: lastMatch.name,
            params: lastMatch.params,
            callId: `${currentSessionIdRef.current}-${lastMsgIndex}`,
          });
        }
      }
    }
  }, [isLoading, messages, handleFunctionCall, getCallState]);

  const msgBgUser = useColorModeValue("blue.500", "blue.600");
  const msgBgBot = "transparent";
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const inputShellBg = useColorModeValue("gray.50", "gray.800");
  const inputShellBorder = useColorModeValue("gray.200", "gray.700");
  const inputBg = useColorModeValue("white", "gray.800");

  let filteredMessages = messages.filter(
    (msg) => msg.role !== "system" && msg.content.trim()
  );
  const canSend = input.trim().length > 0;
  const isBusy = isLoading || hasExecutingCall();

  return (
    <AdvancedCard
      borderRadius="2xl"
      h="100%"
      w="100%"
      p={2}
      sx={{
        "p, span, li, code, h1, h2, h3, h4, h5, h6": {
          transition: "opacity 0.2s ease",
        },
      }}
    >
      <VStack h="100%" w="100%">
        <Flex w="100%" align="center" justify="space-between">
          <MiuChatLogoTitle />
          <HStack spacing={1}>
            <IconButton
              icon={<LuPlus />}
              aria-label="agent-chat-new-chat"
              size="sm"
              variant="ghost"
              onClick={handleNewSession}
            />
            <IconButton
              icon={<LuHistory />}
              aria-label="agent-chat-history"
              size="sm"
              variant="ghost"
              onClick={
                showHistory ? () => setShowHistory(false) : handleShowHistory
              }
            />
            <IconButton
              icon={<LuX />}
              aria-label="agent-chat-close"
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsLoading(false);
                setInput("");
                onAgentChatPanelClose();
              }}
            />
          </HStack>
        </Flex>

        {showHistory ? (
          <Flex w="100%" flex={1} overflowY="auto" direction="column" p={2}>
            {sessions.length === 0 ? (
              <Flex
                direction="column"
                align="center"
                justify="center"
                h="100%"
                color="gray.500"
              >
                <Text>{t("AgentChatPage.noHistory")}</Text>
              </Flex>
            ) : (
              <VStack w="100%" spacing={1} align="stretch">
                {sessions.map((session) => (
                  <OptionItem
                    key={session.id}
                    title={session.title || t("AgentChatPage.untitledSession")}
                    description={new Date(
                      session.updatedAt * 1000
                    ).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    isFullClickZone
                    onClick={() => handleLoadSession(session.id)}
                    isChildrenIndependent
                  >
                    <IconButton
                      icon={<LuTrash2 />}
                      aria-label="delete-session"
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => handleDeleteSession(session.id)}
                    />
                  </OptionItem>
                ))}
              </VStack>
            )}
          </Flex>
        ) : (
          <>
            <Flex
              ref={messagesContainerRef}
              w="100%"
              flex={1}
              overflowY="auto"
              direction="column"
              gap={2}
              fontSize="sm"
            >
              {filteredMessages.length === 0 && (
                <Flex
                  direction="column"
                  align="center"
                  justify="center"
                  h="100%"
                  color="gray.500"
                >
                  <Image
                    boxSize="48px"
                    objectFit="cover"
                    src={AGENT_AVATAR_SRC}
                    alt="agent"
                    mb={4}
                  />
                  <Text>{t("AgentChatPage.description")}</Text>
                </Flex>
              )}
              {filteredMessages.map((msg, i) => {
                const originalIndex = messages.indexOf(msg);

                return (
                  <Flex
                    key={i}
                    direction={msg.role === "user" ? "row-reverse" : "row"}
                    gap={3}
                    width="100%"
                  >
                    {(msg.role !== "user" ||
                      (selectedPlayer && selectedPlayer.avatar)) &&
                      (i > 0 && filteredMessages[i - 1].role === msg.role ? (
                        <Box boxSize="32px" />
                      ) : (
                        <Image
                          boxSize="32px"
                          objectFit="cover"
                          src={
                            msg.role === "user"
                              ? base64ImgSrc(selectedPlayer?.avatar!)
                              : AGENT_AVATAR_SRC
                          }
                          alt={msg.role}
                        />
                      ))}
                    <Box
                      bg={msg.role === "user" ? msgBgUser : msgBgBot}
                      color={msg.role === "user" ? "white" : undefined}
                      p={msg.role === "user" ? 2 : 0}
                      borderRadius="lg"
                      maxW={msg.role === "user" ? "80%" : undefined}
                      w={msg.role === "user" ? undefined : "80%"}
                      position="relative"
                    >
                      <MarkdownContainer
                        messageId={`${currentSessionIdRef.current}-${originalIndex}`}
                      >
                        {msg.content}
                      </MarkdownContainer>
                    </Box>
                  </Flex>
                );
              })}
              {isLoading &&
                messages.length > 0 &&
                messages[messages.length - 1].content === "" && (
                  <Flex direction="row" gap={3}>
                    {filteredMessages.length > 0 &&
                    filteredMessages[filteredMessages.length - 1].role ===
                      "assistant" ? (
                      <Box boxSize="32px" />
                    ) : (
                      <Image
                        boxSize="32px"
                        objectFit="cover"
                        src={AGENT_AVATAR_SRC}
                        alt="agent"
                      />
                    )}
                    <Box bg={msgBgBot} p={2} borderRadius="lg">
                      <Spinner size="sm" speed="0.8s" />
                    </Box>
                  </Flex>
                )}
            </Flex>

            {/* Input */}
            <Box
              w="100%"
              bg={inputShellBg}
              borderWidth={1}
              borderColor={inputShellBorder}
              borderRadius="2xl"
              p={3}
            >
              <Flex direction="column" gap={3}>
                <Textarea
                  placeholder={t("AgentChatPage.placeholder")}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  variant="unstyled"
                  resize="none"
                  minH="60px"
                  size="sm"
                />
                <HStack justify="space-between" align="end">
                  <Text className="secondary-text" fontSize="2xs">
                    {t("AgentChatPage.bottomWarning")}
                  </Text>
                  <IconButton
                    aria-label={isBusy ? "stop" : "send"}
                    icon={isBusy ? <LuPause /> : <LuSend />}
                    colorScheme={
                      isBusy ? "red" : canSend ? primaryColor : "gray"
                    }
                    variant="solid"
                    borderRadius="full"
                    isDisabled={!isBusy && !canSend}
                    onClick={isBusy ? handleStopReply : handleSend}
                  />
                </HStack>
              </Flex>
            </Box>
          </>
        )}
      </VStack>
    </AdvancedCard>
  );
};
export default AgentChat;

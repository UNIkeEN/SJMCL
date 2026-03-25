import {
  Box,
  Button,
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
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuBotMessageSquare,
  LuHistory,
  LuPause,
  LuPlus,
  LuSend,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import AdvancedCard from "@/components/common/advanced-card";
import MarkdownContainer from "@/components/common/markdown-container";
import { OptionItem } from "@/components/common/option-item";
import { MiuChatLogoTitle } from "@/components/logo-title";
import { useLauncherConfig } from "@/contexts/config";
import { useFunctionCallActions } from "@/contexts/function-call";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useAgentLoop } from "@/hooks/use-agent-loop";
import { ChatMessage, ChatSessionSummary } from "@/models/intelligence";
import { getChatSystemPrompt } from "@/prompts";
import { IntelligenceService } from "@/services/intelligence";
import { base64ImgSrc } from "@/utils/string";

const AGENT_AVATAR_SRC = "/images/agent/miuxi_px_avatar.png";

function stripThinkTags(content: string): string {
  const withoutClosedThink = content.replace(/<think>[\s\S]*?<\/think>/g, "");
  const lastOpenIdx = withoutClosedThink.lastIndexOf("<think>");
  const sanitized =
    lastOpenIdx === -1
      ? withoutClosedThink
      : withoutClosedThink.slice(0, lastOpenIdx);

  return sanitized.replace(/\n{3,}/g, "\n\n").trim();
}

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
  const { setCallState, hasExecutingCall } = useFunctionCallActions();

  const { runAgentLoop, clearPendingConfirmation } = useAgentLoop({
    requestIdRef,
    currentSessionIdRef,
    setMessages,
    setIsLoading,
    setCallState,
    toolContext: { config, t, openSharedModal, getGameVersionList },
    toast,
  });

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Check for pending crash context from game-error page
  // Load crash context from localStorage and start diagnosis session
  const loadCrashContext = useCallback(() => {
    const pending = localStorage.getItem("pending-crash-context");
    if (!pending) return;
    localStorage.removeItem("pending-crash-context");

    try {
      const ctx = JSON.parse(pending);
      const contextLines = [
        ctx.instanceName &&
          `实例: ${ctx.instanceName}${ctx.instanceVersion ? ` (${ctx.instanceVersion})` : ""}${ctx.instanceId ? ` [ID: ${ctx.instanceId}]` : ""}`,
        ctx.javaName && `Java: ${ctx.javaName}`,
        ctx.os && `系统: ${ctx.os}`,
        ctx.crashLog && `\n崩溃日志:\n${ctx.crashLog}`,
      ]
        .filter(Boolean)
        .join("\n");

      const newMessages: ChatMessage[] = [
        { role: "system", content: getChatSystemPrompt(i18n.language) },
        {
          role: "user",
          content: `我的游戏崩溃了，请分析并给出可执行修复方案。\n\n${contextLines}`,
        },
      ];

      clearPendingConfirmation();
      requestIdRef.current++;
      currentSessionIdRef.current = crypto.randomUUID();
      sessionCreatedAtRef.current = Math.floor(Date.now() / 1000);
      setMessages(newMessages);
      setInput("");
      setShowHistory(false);

      setTimeout(() => runAgentLoop(newMessages), 0);
    } catch (e) {
      console.error("Failed to parse crash context", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check on mount
  useEffect(() => {
    loadCrashContext();
  }, [loadCrashContext]);

  // Listen for cross-window storage changes (game-error page writes localStorage)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "pending-crash-context" && e.newValue) {
        loadCrashContext();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [loadCrashContext]);

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
    clearPendingConfirmation();
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
      shouldAutoScrollRef.current = true;
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

  const shouldAutoScrollRef = useRef(true);

  const handleContainerScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;
  }, []);

  // When user sends a message or function call starts, re-enable auto-scroll
  useEffect(() => {
    if (isLoading) {
      shouldAutoScrollRef.current = true;
    }
  }, [isLoading]);

  // Auto-scroll on new content only if user hasn't scrolled up
  useEffect(() => {
    if (shouldAutoScrollRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
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
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");

    await runAgentLoop(newMessages);
  };

  const handleStopReply = () => {
    // Cancel current streaming updates by invalidating the request ID
    requestIdRef.current++;
    setIsLoading(false);
  };

  const handleSkipThinking = async () => {
    if (!isBusy) return;

    requestIdRef.current++;
    setIsLoading(false);

    const cleanedMessages = [...messagesRef.current];
    for (let i = cleanedMessages.length - 1; i >= 0; i--) {
      if (cleanedMessages[i].role === "assistant") {
        cleanedMessages[i] = {
          ...cleanedMessages[i],
          content: stripThinkTags(cleanedMessages[i].content),
        };
        break;
      }
    }

    setMessages(cleanedMessages);
    setInput("");
    await runAgentLoop(cleanedMessages, {
      skipThinking: true,
      skipThinkingInstruction: t("AgentChatPage.skipThinkingPrompt"),
    });
  };

  const handleFunctionCallConfirmationAction = async (
    action: "confirm" | "cancel"
  ) => {
    if (isBusy) return;

    const actionText = action === "confirm" ? "确认" : "取消";
    const userMsg: ChatMessage = { role: "user", content: actionText };
    const newMessages = [...messagesRef.current, userMsg];

    setMessages(newMessages);
    setInput("");
    await runAgentLoop(newMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
  const isThinking = React.useMemo(() => {
    if (!isBusy) return false;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "assistant") continue;
      const content = messages[i].content;
      const lastOpen = content.lastIndexOf("<think>");
      if (lastOpen === -1) return false;
      const lastClose = content.lastIndexOf("</think>");
      return lastClose < lastOpen;
    }
    return false;
  }, [messages, isBusy]);

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
              icon={showHistory ? <LuBotMessageSquare /> : <LuHistory />}
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
          <Flex w="100%" flex={1} overflowY="auto" direction="column">
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
                    p={1}
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
              onScroll={handleContainerScroll}
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
                        onFunctionCallAction={
                          handleFunctionCallConfirmationAction
                        }
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
              pt={0}
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
                  <HStack spacing={2}>
                    {isThinking && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSkipThinking}
                      >
                        {t("AgentChatPage.skipThinking")}
                      </Button>
                    )}
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

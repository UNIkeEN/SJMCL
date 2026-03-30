import React from "react";
import { ToolCallState, useToolExecutionContext } from "@/contexts/tool-call";
import { ToolCallStatus } from "@/enums/tool-call";
import { ChatMessage } from "@/models/intelligence/chat";
import { ToolCallMatch } from "@/models/intelligence/tool-call";
import { TOOL_DEFINITIONS } from "@/prompts/tool";
import { IntelligenceService } from "@/services/intelligence";
import { formatPrintable } from "@/utils/string";
import {
  commitToolCall,
  executeToolCall,
  isCancellationMessage,
  isConfirmationMessage,
} from "@/utils/tool-call/executor";
import { findToolCalls, parseToolCallStatus } from "@/utils/tool-call/parser";

const MAX_ITERATIONS = 10;
const MAX_TOOL_RESULT_LENGTH = 4000;

/**
 * Convert mid-conversation system messages to user role before sending to LLM.
 * Fixes Gemini provider which extracts ALL system messages into system_instruction,
 * causing the initial prompt to be overwritten by tool results.
 */
function preprocessMessagesForLLM(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((msg, i) => {
    if (msg.role === "system" && i > 0) {
      return {
        role: "user" as const,
        content: `[Tool Result]\n${msg.content}`,
      };
    }
    return msg;
  });
}

/**
 * Truncate overly large tool results to avoid overwhelming LLM context.
 */
function truncateResult(result: string): string {
  if (result.length <= MAX_TOOL_RESULT_LENGTH) return result;
  return (
    result.substring(0, MAX_TOOL_RESULT_LENGTH) +
    `\n...(truncated, ${result.length} chars total)`
  );
}

interface PendingConfirmation {
  id: string;
  toolName: string;
  params: Record<string, any>;
  previewText: string;
  createdAt: number;
}

interface RunAgentLoopOptions {
  skipThinking?: boolean;
  skipThinkingInstruction?: string;
}

function stripThinkTags(content: string): string {
  const withoutClosedThink = content.replace(/<think>[\s\S]*?<\/think>/g, "");
  const lastOpenIdx = withoutClosedThink.lastIndexOf("<think>");
  const sanitized =
    lastOpenIdx === -1
      ? withoutClosedThink
      : withoutClosedThink.slice(0, lastOpenIdx);

  return sanitized.replace(/\n{3,}/g, "\n\n").trim();
}

export interface AgentLoopDeps {
  requestIdRef: React.MutableRefObject<number>;
  currentSessionIdRef: React.MutableRefObject<string>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsLoading: (loading: boolean) => void;
  setToolCallState: (id: string, state: ToolCallState) => void;
  toast: (options: {
    title: string;
    status: "error" | "info" | "warning" | "success";
  }) => void;
}

export function useAgentLoop(deps: AgentLoopDeps) {
  const toolExecutionContext = useToolExecutionContext();
  const toolExecutionContextRef = React.useRef(toolExecutionContext);
  toolExecutionContextRef.current = toolExecutionContext;

  const depsRef = React.useRef(deps);
  depsRef.current = deps;

  const pendingRef = React.useRef<PendingConfirmation | null>(null);

  const clearPendingConfirmation = React.useCallback(() => {
    pendingRef.current = null;
  }, []);

  const runAgentLoop = React.useCallback(
    async (initialMessages: ChatMessage[], options?: RunAgentLoopOptions) => {
      const {
        requestIdRef,
        currentSessionIdRef,
        setMessages,
        setIsLoading,
        setToolCallState,
        toast,
      } = depsRef.current;

      const toolContext = toolExecutionContextRef.current;
      if (!toolContext) {
        toast({
          title: "Tool execution context is not ready",
          status: "error",
        });
        setIsLoading(false);
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      setIsLoading(true);

      let messages = [...initialMessages];

      // ── Handle pending confirmation ──────────────────────────────
      if (pendingRef.current) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === "user" && isConfirmationMessage(lastMsg.content)) {
          const pending = pendingRef.current;
          pendingRef.current = null;

          let resultStr = "";
          try {
            const result = await commitToolCall(
              pending.toolName,
              pending.params,
              toolContext
            );
            resultStr = truncateResult(formatPrintable(result));
          } catch (e: any) {
            resultStr = `Error: ${e.message || "Unknown error"}`;
          }

          // Add commit result as system message
          messages = [
            ...messages,
            { role: "system" as const, content: resultStr },
          ];
          setMessages([...messages]);
          // Fall through to normal loop — LLM will see the commit result
        } else if (
          lastMsg.role === "user" &&
          isCancellationMessage(lastMsg.content)
        ) {
          pendingRef.current = null;
          messages = [
            ...messages,
            {
              role: "system" as const,
              content: JSON.stringify({
                status: ToolCallStatus.Cancelled,
                message: "Operation cancelled by user",
              }),
            },
          ];
          setMessages([...messages]);
          // Fall through to normal loop — LLM will see the cancellation result
        } else {
          // User didn't confirm, clear pending
          pendingRef.current = null;
          // Fall through to normal loop
        }
      }

      // ── Main agent loop ──────────────────────────────────────────
      try {
        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
          if (requestIdRef.current !== currentRequestId) return;

          // Capture history for LLM (before adding placeholder)
          const historyForLLM = preprocessMessagesForLLM([...messages]);
          if (options?.skipThinking && iteration === 0) {
            historyForLLM.push({
              role: "user",
              content:
                options.skipThinkingInstruction ||
                "Do not output any <think> or chain-of-thought content. Return only concise final answer.",
            });
          }

          // Add empty assistant placeholder for UI
          messages = [...messages, { role: "assistant" as const, content: "" }];
          setMessages([...messages]);

          // Stream LLM response
          let currentResponse = "";
          await IntelligenceService.fetchLLMChatResponse(
            historyForLLM,
            (chunk) => {
              if (requestIdRef.current !== currentRequestId) return;
              currentResponse += chunk;
              const renderResponse = options?.skipThinking
                ? stripThinkTags(currentResponse)
                : currentResponse;
              setMessages((prev) => {
                const updated = [...prev];
                if (updated.length > 0) {
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: renderResponse,
                  };
                }
                return updated;
              });
            }
          );

          // Fallback for non-streaming providers
          if (!currentResponse.trim()) {
            const fallbackResp =
              await IntelligenceService.fetchLLMChatResponse(historyForLLM);
            if (
              requestIdRef.current === currentRequestId &&
              fallbackResp.status === "success"
            ) {
              currentResponse = fallbackResp.data || "";
            }
          }

          if (requestIdRef.current !== currentRequestId) return;

          const finalResponse = options?.skipThinking
            ? stripThinkTags(currentResponse)
            : currentResponse;

          // Sync local array and React state with final response
          messages[messages.length - 1] = {
            role: "assistant",
            content: finalResponse,
          };
          setMessages([...messages]);

          // Parse tool calls
          const toolCalls = findToolCalls(finalResponse).filter(
            (m) => m.type === "success"
          ) as ToolCallMatch[];

          if (toolCalls.length === 0) break;

          // Execute tool calls sequentially
          const assistantMsgIndex = messages.length - 1;
          let waitingForConfirmation = false;

          for (let toolIndex = 0; toolIndex < toolCalls.length; toolIndex++) {
            if (requestIdRef.current !== currentRequestId) return;

            const toolCall = toolCalls[toolIndex];
            const callId = `${currentSessionIdRef.current}-${assistantMsgIndex}-${toolIndex}`;
            const toolDef = TOOL_DEFINITIONS.find(
              (d) => d.name === toolCall.name
            );

            setToolCallState(callId, {
              isExecuting: true,
              result: null,
              error: null,
            });

            let resultStr = "";
            try {
              const result = await executeToolCall(
                toolCall.name,
                toolCall.params,
                toolContext
              );
              resultStr = truncateResult(formatPrintable(result));
              setToolCallState(callId, {
                isExecuting: false,
                result: resultStr,
                error: null,
              });
            } catch (e: any) {
              resultStr = `Error: ${e.message || "Unknown error"}`;
              setToolCallState(callId, {
                isExecuting: false,
                result: null,
                error: resultStr,
              });
            }

            // Add system message with result
            messages = [
              ...messages,
              { role: "system" as const, content: resultStr },
            ];
            setMessages([...messages]);

            // If this is a write tool that requires confirmation, pause the loop
            if (
              toolDef?.requiresConfirmation &&
              parseToolCallStatus(resultStr) !== ToolCallStatus.Error
            ) {
              pendingRef.current = {
                id: callId,
                toolName: toolCall.name,
                params: toolCall.params,
                previewText: resultStr,
                createdAt: Date.now(),
              };
              waitingForConfirmation = true;
              break;
            }
          }

          if (waitingForConfirmation) {
            // Let LLM see the preview and respond, then break the outer loop
            // so the user can confirm
            // Stream one more LLM response to show the preview to the user
            if (requestIdRef.current !== currentRequestId) return;

            const previewHistoryForLLM = preprocessMessagesForLLM([
              ...messages,
            ]);
            messages = [
              ...messages,
              { role: "assistant" as const, content: "" },
            ];
            setMessages([...messages]);

            let previewResponse = "";
            await IntelligenceService.fetchLLMChatResponse(
              previewHistoryForLLM,
              (chunk) => {
                if (requestIdRef.current !== currentRequestId) return;
                previewResponse += chunk;
                const renderPreview = options?.skipThinking
                  ? stripThinkTags(previewResponse)
                  : previewResponse;
                setMessages((prev) => {
                  const updated = [...prev];
                  if (updated.length > 0) {
                    updated[updated.length - 1] = {
                      ...updated[updated.length - 1],
                      content: renderPreview,
                    };
                  }
                  return updated;
                });
              }
            );

            if (!previewResponse.trim()) {
              const fallbackResp =
                await IntelligenceService.fetchLLMChatResponse(
                  previewHistoryForLLM
                );
              if (
                requestIdRef.current === currentRequestId &&
                fallbackResp.status === "success"
              ) {
                previewResponse = fallbackResp.data || "";
              }
            }

            messages[messages.length - 1] = {
              role: "assistant",
              content: options?.skipThinking
                ? stripThinkTags(previewResponse)
                : previewResponse,
            };
            setMessages([...messages]);

            break; // Exit loop — wait for user confirmation
          }

          // Loop continues — next iteration streams the LLM's follow-up response
        }
      } catch (error) {
        if (requestIdRef.current !== currentRequestId) return;
        console.error(error);
        toast({ title: "Error in agent loop", status: "error" });

        setMessages((prev) => {
          const updated = [...prev];
          if (
            updated.length > 0 &&
            updated[updated.length - 1].content === ""
          ) {
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content:
                "**Error:** An error occurred while fetching the response.",
            };
          }
          return updated;
        });
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  return { runAgentLoop, clearPendingConfirmation };
}

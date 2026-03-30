import { Channel, invoke } from "@tauri-apps/api/core";
import { LLMProviderConfig } from "@/models/config";
import {
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
} from "@/models/intelligence/chat";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

/**
 * Service class for managing intelligence services (e.g. LLM) and interactions.
 */
export class IntelligenceService {
  // ─── Provider CRUD ───

  @responseHandler("intelligence")
  public static async saveIntelligenceProvider(
    provider: LLMProviderConfig
  ): Promise<InvokeResponse<void>> {
    return invoke("save_intelligence_provider", { provider });
  }

  @responseHandler("intelligence")
  public static async deleteIntelligenceProvider(
    providerId: string
  ): Promise<InvokeResponse<void>> {
    return invoke("delete_intelligence_provider", { providerId });
  }

  @responseHandler("intelligence")
  public static async setActiveIntelligenceProvider(
    providerId: string
  ): Promise<InvokeResponse<void>> {
    return invoke("set_active_intelligence_provider", { providerId });
  }

  // ─── LLM API ───
  /**
   * CHECK the availability of the LLM service.
   * @param {string} baseUrl The base URL of the LLM service.
   * @param {string} apiKey The API key for authentication.
   * @return {Promise<InvokeResponse<string[]>>}
   */
  @responseHandler("intelligence")
  public static async retrieveLLMModels(
    providerType: string,
    baseUrl: string,
    apiKey: string
  ): Promise<InvokeResponse<string[]>> {
    return invoke("retrieve_llm_models", { providerType, baseUrl, apiKey });
  }

  /**
   * RETRIEVE LLM chat response for a given message.
   * @param {ChatMessage[]} messages The list of chat messages.
   * @param {(chunk: string) => void} [onChunk] Optional callback for streaming response chunks.
   * @return {Promise<InvokeResponse<string>>}
   */
  @responseHandler("intelligence")
  public static async fetchLLMChatResponse(
    messages: ChatMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<InvokeResponse<string>> {
    if (onChunk) {
      const channel = new Channel<string>();
      channel.onmessage = onChunk;
      await invoke("fetch_llm_chat_response_stream", {
        messages,
        onEvent: channel,
      });
      return { status: "success", data: "", message: "Stream completed" };
    }
    return invoke("fetch_llm_chat_response", { messages });
  }

  /**
   * RETRIEVE all chat session summaries.
   * @return {Promise<InvokeResponse<ChatSessionSummary[]>>}
   */
  @responseHandler("intelligence")
  public static async retrieveChatSessions(): Promise<
    InvokeResponse<ChatSessionSummary[]>
  > {
    return invoke("retrieve_chat_sessions");
  }

  /**
   * RETRIEVE a full chat session by ID.
   * @param {string} sessionId The session ID.
   * @return {Promise<InvokeResponse<ChatSession>>}
   */
  @responseHandler("intelligence")
  public static async retrieveChatSession(
    sessionId: string
  ): Promise<InvokeResponse<ChatSession>> {
    return invoke("retrieve_chat_session", { sessionId });
  }

  /**
   * SAVE a chat session (create or update).
   * @param {ChatSession} session The session to save.
   * @return {Promise<InvokeResponse<void>>}
   */
  @responseHandler("intelligence")
  public static async saveChatSession(
    session: ChatSession
  ): Promise<InvokeResponse<void>> {
    return invoke("save_chat_session", { session });
  }

  /**
   * DELETE a chat session by ID.
   * @param {string} sessionId The session ID.
   * @return {Promise<InvokeResponse<void>>}
   */
  @responseHandler("intelligence")
  public static async deleteChatSession(
    sessionId: string
  ): Promise<InvokeResponse<void>> {
    return invoke("delete_chat_session", { sessionId });
  }
}

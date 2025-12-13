import { invoke } from "@tauri-apps/api/core";
import { ChatMessage } from "@/models/intelligence";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

/**
 * Service class for managing intelligence services (e.g. LLM) and interactions.
 */
export class IntelligenceService {
  /**
   * CHECK the availability of the LLM service.
   * @param {string} baseUrl The base URL of the LLM service.
   * @param {string} apiKey The API key for authentication.
   * @param {string} model The LLM model to be used.
   * @return {Promise<InvokeResponse<void>>}
   */
  @responseHandler("intelligence")
  public static async checkLLMServiceAvailability(
    baseUrl: string,
    apiKey: string,
    model: string
  ): Promise<InvokeResponse<void>> {
    return invoke("check_llm_service_availability", { baseUrl, apiKey, model });
  }

  /**
   * RETRIEVE LLM chat response for a given message.
   * @param {ChatMessage[]} messages The list of chat messages.
   * @return {Promise<InvokeResponse<string>>}
   */
  @responseHandler("intelligence")
  public static async fetchLLMChatResponse(
    messages: ChatMessage[]
  ): Promise<InvokeResponse<string>> {
    return invoke("fetch_llm_chat_response", { messages });
  }
}

import { invoke } from "@tauri-apps/api/core";
import { ChatMessage } from "@/models/ai";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

/**
 * Service class for managing AI services and interactions.
 */
export class AiService {
  /**
   * CHECK the availability of the AI service.
   * @param {string} baseUrl The base URL of the AI service.
   * @param {string} apiKey The API key for authentication.
   * @param {string} model The AI model to be used.
   * @return {Promise<InvokeResponse<void>>}
   */
  @responseHandler("ai")
  public static async checkAiServiceAvailability(
    baseUrl: string,
    apiKey: string,
    model: string
  ): Promise<InvokeResponse<void>> {
    return invoke("check_ai_service_availability", { baseUrl, apiKey, model });
  }

  /**
   * RETRIEVE AI chat response for a given message.
   * @param {ChatMessage[]} messages The list of chat messages.
   * @return {Promise<InvokeResponse<string>>}
   */
  @responseHandler("ai")
  public static async retrieveAiChatResponse(
    messages: ChatMessage[]
  ): Promise<InvokeResponse<string>> {
    return invoke("retrieve_ai_chat_response", { messages });
  }
}

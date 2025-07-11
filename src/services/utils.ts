import { invoke } from "@tauri-apps/api/core";
import { MemoryInfo } from "@/models/system-info";

/**
 * RETRIEVE the memory info of the system.
 * @returns {Promise<MemoryInfo>} Memory info, in bytes
 * @throws {Error} If the backend call fails.
 */
export const retrieveMemoryInfo = async (): Promise<MemoryInfo> => {
  try {
    return await invoke("retrieve_memory_info");
  } catch (error) {
    console.error("Error in retrieve_memory_info:", error);
    throw error;
  }
};

/**
 * RETRIEVE the list of installed TrueType fonts.
 * @returns {Promise<string[]>} List of TrueType fonts
 * @throws {Error} If the backend call fails.
 */
export const retrieveFontList = async (): Promise<string[]> => {
  try {
    return await invoke("retrieve_truetype_font_list");
  } catch (error) {
    console.error("Error in retrieve_font_list:", error);
    throw error;
  }
};

/**
 * CHECK the availability of a given service URL.
 * @param url The URL to test.
 * @returns {Promise<number>} Round-trip time in milliseconds.
 * @throws {Error} If the service is unreachable or backend call fails.
 */
export const checkServiceAvailability = async (
  url: string
): Promise<number> => {
  try {
    return await invoke<number>("check_service_availability", { url });
  } catch (error) {
    console.error("Error in check_service_availability:", error);
    throw error;
  }
};

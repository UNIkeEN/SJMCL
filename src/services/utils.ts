import { invoke } from "@tauri-apps/api/core";
import { MemoryInfo } from "@/models/system-info";

/**
 * RETRIVE the memory info of the system.
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

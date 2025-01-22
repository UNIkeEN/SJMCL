import { invoke } from "@tauri-apps/api/core";
import { MemoryInfo } from "@/models/system-info";

/**
 * Fetches the memory info of the system.
 * @returns {Promise<MemoryInfo>} Memory info, in bytes
 * @throws {Error} If the backend call fails.
 */
export const getMemoryInfo = async (): Promise<MemoryInfo> => {
  try {
    return await invoke("get_memory_info");
  } catch (error) {
    console.error("Error in get_memory_info:", error);
    throw error;
  }
};

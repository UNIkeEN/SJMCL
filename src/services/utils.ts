import { invoke } from "@tauri-apps/api/core";
import { MemoryInfo } from "@/models/system-info";

/**
 * RETRIVE the memory info of the system.
 * @returns {Promise<MemoryInfo>} Memory info, in bytes
 * @throws {Error} If the backend call fails.
 */
export const retriveMemoryInfo = async (): Promise<MemoryInfo> => {
  try {
    return await invoke("retrive_memory_info");
  } catch (error) {
    console.error("Error in retrive_memory_info:", error);
    throw error;
  }
};

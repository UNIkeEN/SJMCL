import { invoke } from "@tauri-apps/api/core";
import { InvokeResponse } from "@/models/response";
import { MemoryInfo } from "@/models/system-info";
import { responseHandler } from "@/utils/response";

/**
 * UtilsService class for general utility functions (system info, fonts, services).
 */
export class UtilsService {
  /**
   * RETRIEVE the memory info of the system.
   * @returns {Promise<InvokeResponse<MemoryInfo>>}
   */
  @responseHandler("utils")
  static async retrieveMemoryInfo(): Promise<InvokeResponse<MemoryInfo>> {
    return await invoke("retrieve_memory_info");
  }

  /**
   * RETRIEVE the list of installed TrueType fonts.
   * @returns {Promise<InvokeResponse<string[]>>}
   */
  @responseHandler("utils")
  static async retrieveFontList(): Promise<InvokeResponse<string[]>> {
    return await invoke("retrieve_truetype_font_list");
  }

  /**
   * CHECK the availability of a given service URL.
   * @param url The URL to test.
   * @returns {Promise<InvokeResponse<number>>} Round-trip time in milliseconds.
   */
  @responseHandler("utils")
  static async checkServiceAvailability(
    url: string
  ): Promise<InvokeResponse<number>> {
    return await invoke("check_service_availability", { url });
  }

  /**
   * EXTRACT the file name from a path.
   * @param pathStr The full path string.
   * @param withExt Whether to keep the file extension.
   * @returns {Promise<InvokeResponse<string>>}
   */
  @responseHandler("utils")
  static async extractFilename(
    pathStr: string,
    withExt: boolean
  ): Promise<InvokeResponse<string>> {
    return await invoke("extract_filename", { pathStr, withExt });
  }

  /**
   * DELETE a file by absolute path.
   * @param path the file to delete.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("utils")
  static async deleteFile(path: string): Promise<InvokeResponse<void>> {
    return await invoke("delete_file", { path });
  }

  /**
   * DELETE a directory by absolute path.
   * This method deletes the directory recursively, including all its contents.
   * @param path the directory to delete.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("utils")
  static async deleteDirectory(path: string): Promise<InvokeResponse<void>> {
    return await invoke("delete_directory", { path });
  }

  /**
   * READ a UTF-8 text file by absolute path.
   * @param path the file to read.
   * @returns {Promise<InvokeResponse<string>>}
   */
  @responseHandler("utils")
  static async readFile(path: string): Promise<InvokeResponse<string>> {
    return await invoke("read_file", { path });
  }

  /**
   * WRITE a UTF-8 text file by absolute path.
   * This method overwrites the target file if it already exists.
   * @param path the file to write.
   * @param content the text content to write.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("utils")
  static async writeFile(
    path: string,
    content: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("write_file", { path, content });
  }
}

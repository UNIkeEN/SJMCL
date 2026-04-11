import { invoke } from "@tauri-apps/api/core";
import { ExtensionInfo } from "@/models/extension";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

/**
 * Service class for managing launcher extensions.
 */
export class ExtensionService {
  /**
   * RETRIEVE the list of installed extensions.
   * @returns {Promise<InvokeResponse<ExtensionInfo[]>>}
   */
  @responseHandler("extension")
  static async retrieveExtensionList(): Promise<
    InvokeResponse<ExtensionInfo[]>
  > {
    return await invoke("retrieve_extension_list");
  }

  /**
   * ADD an extension package by path.
   * @param {string} path The absolute path of the extension package (.sjmclx).
   * @returns {Promise<InvokeResponse<ExtensionInfo>>}
   */
  @responseHandler("extension")
  static async addExtension(
    path: string
  ): Promise<InvokeResponse<ExtensionInfo>> {
    return await invoke("add_extension", { path });
  }

  /**
   * DELETE an installed extension by identifier.
   * @param {string} identifier The extension identifier.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("extension")
  static async deleteExtension(
    identifier: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("delete_extension", { identifier });
  }
}

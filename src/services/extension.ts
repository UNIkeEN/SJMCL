import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { ExtensionInfo } from "@/models/extension";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

export const EXTENSION_REFRESH_EVENT = "extension:refresh-list";

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
   * @param {string} [expectedIdentifier] The identifier expected from the package metadata. (for extension update scenario)
   * @returns {Promise<InvokeResponse<ExtensionInfo>>}
   */
  @responseHandler("extension")
  static async addExtension(
    path: string,
    expectedIdentifier?: string
  ): Promise<InvokeResponse<ExtensionInfo>> {
    return await invoke("add_extension", { path, expectedIdentifier });
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

  /**
   * Listen for extension refresh events.
   * @param callback - The callback to be invoked when an extension refresh event occurs.
   */
  static onExtensionRefresh(callback: () => void): () => void {
    const unlisten = getCurrentWebview().listen<void>(
      EXTENSION_REFRESH_EVENT,
      () => {
        callback();
      }
    );

    return () => {
      unlisten.then((f) => f());
    };
  }
}

import { invoke } from "@tauri-apps/api/core";
import { AuthServer, Player } from "@/models/account";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

const errorToLocaleKey: { [key: string]: string } = {
  DUPLICATE: "duplicate",
  INVALID: "invalid",
  NOT_FOUND: "notFound",
  TEXTURE_ERROR: "textureError",
  AUTH_SERVER_ERROR: "authServerError",
  CANCELLED: "cancelled",
};

/**
 * Service class for managing accounts, players, and authentication servers.
 */
export class AccountService {
  /**
   * RETRIVE the list of players.
   * @returns {Promise<InvokeResponse<Player[]>>}
   */
  @responseHandler("account", errorToLocaleKey)
  static async retrivePlayerList(): Promise<InvokeResponse<Player[]>> {
    return await invoke("retrive_player_list");
  }

  /**
   * ADD a new player to the system using offline login.
   * @param {string} username - The username of the player to be added.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account", errorToLocaleKey)
  static async addPlayerOffline(
    username: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("add_player_offline", {
      username,
    });
  }

  /**
   * ADD a new player to the system using new authlib_injector's OAuth.
   * @param {string} authServerUrl - The authentication server's URL.
   * @param {string} openidConfigurationUrl - The authentication server's openid configuration url.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account", errorToLocaleKey)
  static async addPlayer3rdPartyOAuth(
    authServerUrl: string,
    openidConfigurationUrl: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("add_player_3rdparty_oauth", {
      authServerUrl,
      openidConfigurationUrl,
    });
  }

  /**
   * UPDATE the skin of an offline player within preset roles (Steve, Alex).
   * @param {string} uuid - The UUID of the player to be updated.
   * @param {string} presetRole - The preset role that the player's skin will be.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account", errorToLocaleKey)
  static async updatePlayerSkinOfflinePreset(
    uuid: string,
    presetRole: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("update_player_skin_offline_preset", {
      uuid,
      presetRole,
    });
  }

  /**
   * DELETE a player by UUID.
   * @param {string} uuid - The UUID of the player to be deleted.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account", errorToLocaleKey)
  static async deletePlayer(uuid: string): Promise<InvokeResponse<void>> {
    return await invoke("delete_player", { uuid });
  }

  /**
   * RETRIVE the selected player by UUID.
   * @returns {Promise<InvokeResponse<Player>>}
   */
  @responseHandler("account", errorToLocaleKey)
  static async retriveSelectedPlayer(): Promise<InvokeResponse<Player>> {
    return await invoke("retrive_selected_player");
  }

  /**
   * UPDATE the selected player by UUID.
   * @param {string} uuid - The UUID of the player to be posted as selected.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account", errorToLocaleKey)
  static async updateSelectedPlayer(
    uuid: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("update_selected_player", { uuid });
  }

  /**
   * RETRIVE the list of authentication servers.
   * @returns {Promise<InvokeResponse<AuthServer[]>>}
   */
  @responseHandler("account", errorToLocaleKey)
  static async retriveAuthServerList(): Promise<InvokeResponse<AuthServer[]>> {
    return await invoke("retrive_auth_server_list");
  }

  /**
   * FETCH the information of a new authentication server.
   * @param {string} url - The URL of the authentication server to be added.
   * @returns {Promise<InvokeResponse<AuthServer>>}
   */
  @responseHandler("account", errorToLocaleKey)
  static async fetchAuthServerInfo(
    url: string
  ): Promise<InvokeResponse<AuthServer>> {
    return await invoke("fetch_auth_server_info", { url });
  }

  /**
   * ADD the new authentication server to the storage.
   * @param {string} authUrl - The authentication server URL (already formatted by backend).
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account", errorToLocaleKey)
  static async addAuthServer(authUrl: string): Promise<InvokeResponse<void>> {
    return await invoke("add_auth_server", { authUrl });
  }

  /**
   * DELETE the authentication server by URL.
   * @param {string} url - The URL of the authentication server to be deleted.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account", errorToLocaleKey)
  static async deleteAuthServer(url: string): Promise<InvokeResponse<void>> {
    return await invoke("delete_auth_server", { url });
  }
}

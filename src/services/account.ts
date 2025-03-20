import { invoke } from "@tauri-apps/api/core";
import { AuthServer, OAuthCodeResponse, Player } from "@/models/account";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

/**
 * Service class for managing accounts, players, and authentication servers.
 */
export class AccountService {
  /**
   * RETRIEVE the list of players.
   * @returns {Promise<InvokeResponse<Player[]>>}
   */
  @responseHandler("account")
  static async retrievePlayerList(): Promise<InvokeResponse<Player[]>> {
    return await invoke("retrieve_player_list");
  }

  /**
   * ADD a new player to the system using offline login.
   * @param {string} username - The username of the player to be added.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async addPlayerOffline(
    username: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("add_player_offline", {
      username,
    });
  }

  /**
   * FETCH the user code using both OAuth methods (Microsoft and 3rd party).
   * @param {string} serverType - The type of authentication server (Microsoft or 3rd party).
   * @param {string} authServerUrl - (Optional) The authentication server's URL.
   * @returns {Promise<InvokeResponse<OAuthCodeResponse>>}
   */
  @responseHandler("account")
  static async fetchOAuthCode(
    serverType: "3rdparty" | "microsoft",
    authServerUrl: string
  ): Promise<InvokeResponse<OAuthCodeResponse>> {
    return await invoke("fetch_oauth_code", {
      serverType,
      authServerUrl,
    });
  }

  /**
   * ADD the player using both OAuth methods (Microsoft and 3rd party).
   * @param {string} serverType - The type of authentication server (Microsoft or 3rd party).
   * @param {OAuthCodeResponse} authInfo - The authentication information (code and verification URI).
   * @param {string} authServerUrl - (Optional) The authentication server's URL.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async addPlayerOAuth(
    serverType: "3rdparty" | "microsoft",
    authInfo: OAuthCodeResponse,
    authServerUrl: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("add_player_oauth", {
      serverType,
      authInfo,
      authServerUrl,
    });
  }

  /**
   * ADD a new player to the system using authlib_injector's password authentication.
   * @param {string} authServerUrl - The authentication server's URL.
   * @param {string} username - The username of the player to be added.
   * @param {string} password - The password of the player to be added.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async addPlayer3rdPartyPassword(
    authServerUrl: string,
    username: string,
    password: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("add_player_3rdparty_password", {
      authServerUrl,
      username,
      password,
    });
  }

  /**
   * UPDATE the skin of an offline player within preset roles (Steve, Alex).
   * @param {string} playerId - The player ID of the player to be updated.
   * @param {string} presetRole - The preset role that the player's skin will be.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async updatePlayerSkinOfflinePreset(
    playerId: string,
    presetRole: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("update_player_skin_offline_preset", {
      playerId,
      presetRole,
    });
  }

  /**
   * DELETE a player by player ID.
   * @param {string} playerId - The player ID of the player to be deleted.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async deletePlayer(playerId: string): Promise<InvokeResponse<void>> {
    return await invoke("delete_player", { playerId });
  }

  /**
   * RETRIEVE the selected player by player ID.
   * @returns {Promise<InvokeResponse<Player>>}
   */
  @responseHandler("account")
  static async retrieveSelectedPlayer(): Promise<InvokeResponse<Player>> {
    return await invoke("retrieve_selected_player");
  }

  /**
   * UPDATE the selected player by player ID.
   * @param {string} playerId - The player ID of the player to be posted as selected.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async updateSelectedPlayer(
    playerId: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("update_selected_player", { playerId });
  }

  /**
   * RETRIEVE the list of authentication servers.
   * @returns {Promise<InvokeResponse<AuthServer[]>>}
   */
  @responseHandler("account")
  static async retrieveAuthServerList(): Promise<InvokeResponse<AuthServer[]>> {
    return await invoke("retrieve_auth_server_list");
  }

  /**
   * FETCH the information of a new authentication server.
   * @param {string} url - The URL of the authentication server to be added.
   * @returns {Promise<InvokeResponse<AuthServer>>}
   */
  @responseHandler("account")
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
  @responseHandler("account")
  static async addAuthServer(authUrl: string): Promise<InvokeResponse<void>> {
    return await invoke("add_auth_server", { authUrl });
  }

  /**
   * DELETE the authentication server by URL.
   * @param {string} url - The URL of the authentication server to be deleted.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async deleteAuthServer(url: string): Promise<InvokeResponse<void>> {
    return await invoke("delete_auth_server", { url });
  }
}

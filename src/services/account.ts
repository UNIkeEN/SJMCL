import { invoke } from "@tauri-apps/api/core";
import { ImportLauncherType, SkinModel, TextureType } from "@/enums/account";
import { AuthServer, DeviceAuthResponseInfo, Player } from "@/models/account";
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
   * @param {string} [uuid] - (Optional) The UUID of the player to be added.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async addPlayerOffline(
    username: string,
    uuid?: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("add_player_offline", {
      username,
      uuid: uuid || "",
    });
  }

  /**
   * FETCH the user code using both OAuth methods (Microsoft and 3rd party).
   * @param {string} serverType - The type of authentication server (Microsoft or 3rd party).
   * @param {string} [authServerUrl] - (Optional) The authentication server's URL.
   * @returns {Promise<InvokeResponse<DeviceAuthResponseInfo>>}
   */
  @responseHandler("account")
  static async fetchOAuthCode(
    serverType: "3rdparty" | "microsoft",
    authServerUrl?: string
  ): Promise<InvokeResponse<DeviceAuthResponseInfo>> {
    return await invoke("fetch_oauth_code", {
      serverType,
      authServerUrl: authServerUrl || "",
    });
  }

  /**
   * ADD the player using both OAuth methods (Microsoft and 3rd party).
   * @param {string} serverType - The type of authentication server (Microsoft or 3rd party).
   * @param {DeviceAuthResponseInfo} authInfo - The authentication information (code and verification URI).
   * @param {string} [authServerUrl] - (Optional) The authentication server's URL.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async addPlayerOAuth(
    serverType: "3rdparty" | "microsoft",
    authInfo: DeviceAuthResponseInfo,
    authServerUrl?: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("add_player_oauth", {
      serverType,
      authInfo,
      authServerUrl: authServerUrl || "",
    });
  }

  /**
   * RE-LOGIN a player using both OAuth methods (Microsoft and 3rd party).
   * @param {string} playerId - The player ID of the player to be re-logged in.
   * @param {DeviceAuthResponseInfo} authInfo - The authentication information (code and verification URI).
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async reloginPlayerOAuth(
    playerId: string,
    authInfo: DeviceAuthResponseInfo
  ): Promise<InvokeResponse<void>> {
    return await invoke("relogin_player_oauth", { playerId, authInfo });
  }

  /**
   * CANCEL the OAuth process.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async cancelOAuth(): Promise<InvokeResponse<void>> {
    return await invoke("cancel_oauth");
  }

  /**
   * ADD a new player to the system using authlib_injector's password authentication.
   * @param {string} authServerUrl - The authentication server's URL.
   * @param {string} username - The username of the player to be added.
   * @param {string} password - The password of the player to be added.
   * @returns {Promise<InvokeResponse<Player[]>>} - The array of players within the account. If it's not empty, should trigger the selection interface.
   */
  @responseHandler("account")
  static async addPlayer3rdPartyPassword(
    authServerUrl: string,
    username: string,
    password: string
  ): Promise<InvokeResponse<Player[]>> {
    return await invoke("add_player_3rdparty_password", {
      authServerUrl,
      username,
      password,
    });
  }

  /**
   * RE-LOGIN a player using authlib_injector's password authentication.
   * @param {string} playerId - The player ID of the player to be re-logged in.
   * @param {string} password - The password of the player to be re-logged in.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async reloginPlayer3rdPartyPassword(
    playerId: string,
    password: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("relogin_player_3rdparty_password", {
      playerId,
      password,
    });
  }

  /**
   * ADD a new player to the system from selection interface.
   * @param {Player} player - The player object to be added.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async addPlayerFromSelection(
    player: Player
  ): Promise<InvokeResponse<void>> {
    return await invoke("add_player_from_selection", { player });
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
   * UPDATE the skin of an offline player using a local image file.
   * @param {string} playerId - The player ID of the player to be updated.
   * @param {string} imagePath - The local image file path of the new skin.
   * @param {TextureType} textureType - The texture type ("skin" or "cape").
   * @param {SkinModel} skinModel - The skin model ("slim" or "default") if the texture type is "skin".
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async updatePlayerSkinOfflineLocal(
    playerId: string,
    imagePath: string,
    textureType: TextureType,
    skinModel: SkinModel
  ): Promise<InvokeResponse<void>> {
    return await invoke("update_player_skin_offline_local", {
      playerId,
      imagePath,
      textureType,
      skinModel,
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
   * REFRESH a player (3rd-party or Microsoft) by player ID.
   * @param {string} playerId - The player ID of the player to be refreshed.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async refreshPlayer(playerId: string): Promise<InvokeResponse<void>> {
    return await invoke("refresh_player", { playerId });
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
   * FETCH the new authentication server.
   * @param {string} url - The URL of the authentication server to be added.
   * @returns {Promise<InvokeResponse<AuthServer>>}
   */
  @responseHandler("account")
  static async fetchAuthServer(
    url: string
  ): Promise<InvokeResponse<AuthServer>> {
    return await invoke("fetch_auth_server", { url });
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

  /**
   * RETRIEVE other launcher account info for importing (stage 1).
   * @param {ImportLauncherType} launcherType - The external launcher type (e.g., HMCL / PCL).
   * @returns {Promise<InvokeResponse<[Player[], AuthServer[]]>>} - The other launcher account info for user selection.
   */
  @responseHandler("account")
  static async retrieveOtherLauncherAccountInfo(
    launcherType: ImportLauncherType
  ): Promise<InvokeResponse<[Player[], AuthServer[]]>> {
    return await invoke("retrieve_other_launcher_account_info", {
      launcherType,
    });
  }

  /**
   * IMPORT external account info into the current launcher (stage 2).
   * @param {Player[]} players - The array of players to be imported.
   * @param {AuthServer[]} authServers - The array of authentication servers to be imported.
   * @returns {Promise<InvokeResponse<void>>}
   */
  @responseHandler("account")
  static async importExternalAccountInfo(
    players: Player[],
    authServers: AuthServer[]
  ): Promise<InvokeResponse<void>> {
    return await invoke("import_external_account_info", {
      players,
      authServers,
    });
  }
}

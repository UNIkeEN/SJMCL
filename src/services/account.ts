import { invoke } from "@tauri-apps/api/core";
import { AuthServer, Player, PlayerInfo } from "@/models/account";

/**
 * Fetches the list of players.
 * @returns {Promise<Player[]>} A promise that resolves to an array of Player objects.
 * @throws Will throw an error if the invocation fails.
 */
export const getPlayerList = async (): Promise<Player[]> => {
  try {
    return await invoke<Player[]>("get_players");
  } catch (error) {
    console.error("Error in get_players:", error);
    throw error;
  }
};

/**
 * Adds a new player to the system.
 * @param {PlayerInfo} player - The information of the player to be added.
 * @returns {Promise<void>} A promise that resolves when the player is successfully added.
 * @throws Will throw an error if the invocation of "add_player" fails.
 */
export const addPlayer = async (player: PlayerInfo): Promise<void> => {
  try {
    await invoke("add_player", { player });
  } catch (error) {
    console.error("Error in add_player:", error);
    throw error;
  }
};

/**
 * Deletes a player by UUID.
 * @param {string} uuid - The UUID of the player to be deleted.
 * @returns {Promise<void>} A promise that resolves when the player is deleted.
 * @throws Will throw an error if the invocation fails.
 */
export const deletePlayer = async (uuid: string): Promise<void> => {
  try {
    await invoke("delete_player", { uuid });
  } catch (error) {
    console.error("Error in delete_player:", error);
    throw error;
  }
};

/**
 * Fetches the list of authentication servers.
 * @returns {Promise<AuthServer[]>} A promise that resolves to an array of AuthServer objects.
 * @throws Will throw an error if the invocation fails.
 */
export const getAuthServerList = async (): Promise<AuthServer[]> => {
  try {
    return await invoke<AuthServer[]>("get_auth_servers");
  } catch (error) {
    console.error("Error in get_auth_servers:", error);
    throw error;
  }
};

/**
 * Gets the information of a new authentication server.
 * @param {string} url - The URL of the authentication server to be added.
 * @returns {Promise<AuthServer>} A promise that resolves to an object containing the new server's name & formatted URL.
 * @throws Will throw an error if the invocation of "get_auth_server_info" fails.
 */
export const getAuthServerInfo = async (url: string): Promise<AuthServer> => {
  try {
    return await invoke("get_auth_server_info", { url });
  } catch (error) {
    console.error("Error in get_auth_server_info:", error);
    throw error;
  }
};

/**
 * Adds the new authentication server to the storage.
 * @param {string} authUrl - The authentication server url (already formatted by backend).
 * @returns {Promise<void>} A promise that resolves when the server is added.
 * @throws Will throw an error if the invocation of "add_auth_server" fails.
 */
export const addAuthServer = async (authUrl: string): Promise<void> => {
  try {
    await invoke("add_auth_server", { authUrl });
  } catch (error) {
    console.error("Error in add_auth_server:", error);
    throw error;
  }
};

/**
 * Deletes an authentication server by URL.
 * @param {string} url - The URL of the authentication server to be deleted.
 * @returns {Promise<void>} A promise that resolves when the server is deleted.
 * @throws Will throw an error if the invocation fails.
 */
export const deleteAuthServer = async (url: string): Promise<void> => {
  try {
    await invoke("delete_auth_server", { url });
  } catch (error) {
    console.error("Error in delete_auth_server:", error);
    throw error;
  }
};

import { invoke } from "@tauri-apps/api/core";
import { AuthServer } from "@/models/auth_server";

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
 * Adds a new authentication server.
 * @param {string} url - The URL of the authentication server to be added.
 * @returns {Promise<string>} A promise that resolves to the server name from fetching the API.
 * @throws Will throw an error if the invocation of "add_auth_server" fails.
 */
export const addAuthServer = async (url: string): Promise<string> => {
  try {
    return await invoke("add_auth_server", { url });
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

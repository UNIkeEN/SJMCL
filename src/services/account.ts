import { invoke } from "@tauri-apps/api/core";
import { Player, PlayerInfo } from "@/models/account";

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

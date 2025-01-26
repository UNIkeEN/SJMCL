import { invoke } from "@tauri-apps/api/core";
import { GameServerInfo } from "@/models/game-instance";

/**
 * Fetches the list of game servers.
 * @param {number} instanceId - The instance ID to fetch the game servers for.
 * @param {boolean} queryOnline - A flag to determine whether to query online server status.
 * @returns {Promise<GameServerInfo[]>} A promise that resolves to an array of GameServerInfo objects.
 * @throws Will throw an error if the invocation fails.
 */
export const getGameServers = async (
  instanceId: number,
  queryOnline: boolean
): Promise<GameServerInfo[]> => {
  console.log(instanceId, queryOnline);
  try {
    return await invoke<GameServerInfo[]>("get_game_servers", {
      instanceId,
      queryOnline,
    });
  } catch (error) {
    console.error("Error in get_game_servers:", error);
    throw error;
  }
};

import { Player } from "@/models/account";

export function genPlayerId(player: Player) {
  let serverIdentity = player.authServer?.authUrl ?? "";

  if (player.playerType === "offline") {
    serverIdentity = "OFFLINE";
  } else if (player.playerType === "microsoft") {
    serverIdentity = "MICROSOFT";
  }

  return `${player.name}${serverIdentity}`;
}

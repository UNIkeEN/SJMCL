import { AuthServer, Player } from "@/models/account";

export const mockAuthServerList: AuthServer[] = [
  { name: "SJMC 用户中心", authUrl: "https://skin.mc.sjtu.cn/api/yggdrasil" },
  {
    name: "MUA 用户中心",
    authUrl: "https://skin.mualliance.ltd/api/yggdrasil",
  },
];

export const mockPlayerList: Player[] = [
  {
    id: 1,
    name: "Unicorn",
    uuid: "4ca3a46a-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    avatarSrc: "https://skin.mc.sjtu.cn/avatar/2?size=72&png=1",
    type: "3rdparty",
    authServer: {
      name: "SJMC 用户中心",
      authUrl: "https://skin.mc.sjtu.cn/api/yggdrasil",
    },
    authAccount: "xxxxxx@sjtu.edu.cn",
  },
  {
    id: 2,
    name: "ynk",
    uuid: "176235f4-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    avatarSrc: "https://skin.mc.sjtu.cn/avatar/308?size=72&png=1",
    type: "3rdparty",
    authServer: {
      name: "SJMC 用户中心",
      authUrl: "https://skin.mc.sjtu.cn/api/yggdrasil",
    },
    authAccount: "yyyyyy@sjtu.edu.cn",
  },
  {
    id: 3,
    name: "Test_offline",
    uuid: "00000000-0000-0000-0000-000000000000",
    avatarSrc: "https://skin.mc.sjtu.cn/avatar/310?size=72&png=1",
    type: "offline",
  },
  {
    id: 4,
    name: "FF98sha_MUA",
    uuid: "3e80b70e-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    avatarSrc: "https://skin.mc.sjtu.cn/avatar/3?size=72&png=1",
    type: "3rdparty",
    authServer: {
      name: "MUA 用户中心",
      authUrl: "https://skin.mualliance.ltd/api/yggdrasil",
    },
    authAccount: "xxxxxx@sjtu.edu.cn",
  },
];

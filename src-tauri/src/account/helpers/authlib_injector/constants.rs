pub static PRESET_AUTH_SERVERS: [&str; 2] = [
  "https://skin.mc.sjtu.cn/api/yggdrasil",
  "https://skin.mualliance.ltd/api/yggdrasil",
];
pub static CLIENT_IDS: [(&str, &str); 3] = [
  ("skin.mc.sjtu.cn", "6"),
  ("skin.mualliance.ltd", "27"),
  ("littleskin.cn", "1014"),
];
pub static SCOPE: &str =
  "openid offline_access Yggdrasil.PlayerProfiles.Select Yggdrasil.Server.Join";
pub static AUTHLIB_INJECTOR_JAR_NAME: &str = "authlib-injector.jar";
pub static TEXTURE_TYPES: [&str; 2] = ["SKIN", "CAPE"];

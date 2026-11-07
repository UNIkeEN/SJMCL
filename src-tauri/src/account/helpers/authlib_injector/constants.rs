pub static AUTHLIB_INJECTOR_JAR_NAME: &str = "authlib-injector.jar";
pub static PRESET_AUTH_SERVERS: [&str; 3] = [
  "https://skin.mc.sjtu.cn/api/yggdrasil",
  "https://skin.mualliance.ltd/api/yggdrasil",
  "https://littleskin.cn/api/yggdrasil",
];
pub static SCOPE: &str =
  "openid offline_access Yggdrasil.PlayerProfiles.Select Yggdrasil.Server.Join";

pub static CLIENT_IDS: [(&str, &str); 7] = [
  // built-in preset auth servers
  ("skin.mc.sjtu.cn", "6"),
  ("skin.mualliance.ltd", "27"),
  ("littleskin.cn", "1014"),
  // supported MUA auth servers (ref: https://github.com/SJMC-Dev/SJMCL-client-ids)
  ("hall.mc.taru.xj.cn", "yggc_kPHIuWBoMhlkThX1"),
  ("oauth.ustb.world", "6"),
  ("skin.jsumc.fun", "2"),
  ("user.suesmc.ltd", "4"),
];

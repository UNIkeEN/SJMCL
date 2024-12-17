import { Box, Divider, Text } from "@chakra-ui/react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";

interface World {
  name: string;
  lastPlayedAt: string;
  iconUrl: string;
}

interface GameServer {
  icon: string;
  ip: string;
  name: string;
}

const WorldsPage = () => {
  const localWorlds: World[] = [
    {
      name: "单人世界 1",
      lastPlayedAt: "2024-12-18 10:00",
      iconUrl: "https://example.com/world1-icon.png",
    },
  ];
  const gameServers: GameServer[] = [
    {
      icon: "data:image/png;base64,<<BASE64数据>>",
      ip: "play.example1.com:25565",
      name: "服务器 1",
    },
  ];
  const { t } = useTranslation();
  return (
    <Box p={4}>
      <OptionItemGroup
        title={t("WorldsPage.worldList.local")}
        items={
          localWorlds.length > 0
            ? localWorlds.map((world) => (
                <OptionItem
                  key={world.name}
                  title={world.name}
                  description={`${t("WorldsPage.worldList.lastPlayedAt")}: ${world.lastPlayedAt}`}
                  prefixElement={
                    <Image
                      src={world.iconUrl}
                      alt={world.name}
                      width={30}
                      height={30}
                      style={{ borderRadius: "4px" }}
                      priority
                    />
                  }
                >
                  <></>
                </OptionItem>
              ))
            : [
                <Text
                  key="no-worlds"
                  fontSize="sm"
                  color="gray.500"
                  textAlign="center"
                >
                  {t("WorldsPage.worldList.empty")}
                </Text>,
              ]
        }
      />

      <Divider my={6} />

      <OptionItemGroup
        title={t("WorldsPage.serverList.local")}
        items={
          gameServers.length > 0
            ? gameServers.map((server) => (
                <OptionItem
                  key={server.ip}
                  title={server.name}
                  description={`IP: ${server.ip}`}
                  prefixElement={
                    <Image
                      src={server.icon}
                      alt={server.name}
                      width={30}
                      height={30}
                      style={{ borderRadius: "4px" }}
                    />
                  }
                >
                  <></>
                </OptionItem>
              ))
            : [
                <Text
                  key="no-servers"
                  fontSize="sm"
                  color="gray.500"
                  textAlign="center"
                >
                  {t("WorldsPage.serverList.empty")}
                </Text>,
              ]
        }
      />
    </Box>
  );
};

export default WorldsPage;

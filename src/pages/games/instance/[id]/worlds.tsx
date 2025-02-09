import { Image } from "@chakra-ui/react";
import { HStack, Tag, TagLabel, Text } from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuX } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useInstanceSharedData } from "@/contexts/instance";
import { GameServerInfo, WorldInfo } from "@/models/game-instance";
import { mockWorlds } from "@/models/mock/game-instance";
import { retriveGameServerList } from "@/services/instance";
import { formatRelativeTime } from "@/utils/datetime";

const InstanceWorldsPage = () => {
  const { t } = useTranslation();

  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [gameServers, setGameServers] = useState<GameServerInfo[]>([]);
  const { summary } = useInstanceSharedData();

  useEffect(() => {
    setWorlds(mockWorlds);

    (async () => {
      if (summary?.id) {
        setGameServers(await retriveGameServerList(summary.id, false)); // without online query, quickly get server list from local servers.dat to render
        setGameServers(await retriveGameServerList(summary.id, true));
      }
    })();

    // refresh every minute to query server info
    const intervalId = setInterval(async () => {
      if (summary?.id) {
        setGameServers(await retriveGameServerList(summary.id, true));
      }
    }, 60000);
    return () => clearInterval(intervalId);
  }, [summary?.id]);

  const worldItemMenuOperations = (save: WorldInfo) => [
    {
      label: "",
      icon: "copyOrMove",
      onClick: () => {},
    },
    {
      label: "",
      icon: "revealFile",
      onClick: () => revealItemInDir(save.filePath),
    },
  ];

  return (
    <>
      <Section
        isAccordion
        title={t("InstanceWorldsPage.worldList.title")}
        titleExtra={<CountTag count={worlds.length} />}
      >
        {worlds.length > 0 ? (
          <OptionItemGroup
            items={worlds.map((world) => {
              const difficulty = t(
                `InstanceWorldsPage.worldList.difficulty.${world.difficulty}`
              );
              const gamemode = t(
                `InstanceWorldsPage.worldList.gamemode.${world.gamemode}`
              );

              return (
                <OptionItem
                  key={world.name}
                  title={world.name}
                  description={`${t(
                    "InstanceWorldsPage.worldList.lastPlayedAt"
                  )} ${formatRelativeTime(world.lastPlayedAt, t)}${t("InstanceWorldsPage.worldList.moreDesc", { gamemode, difficulty })}`}
                  prefixElement={
                    <Image
                      src={world.iconSrc}
                      alt={world.name}
                      boxSize="28px"
                      style={{ borderRadius: "4px" }}
                    />
                  }
                >
                  <HStack spacing={0}>
                    {worldItemMenuOperations(world).map((item, index) => (
                      <CommonIconButton
                        key={index}
                        icon={item.icon}
                        label={item.label}
                        onClick={item.onClick}
                      />
                    ))}
                  </HStack>
                </OptionItem>
              );
            })}
          />
        ) : (
          <Empty withIcon={false} size="sm" />
        )}
      </Section>

      <Section
        isAccordion
        title={t("InstanceWorldsPage.serverList.title")}
        titleExtra={<CountTag count={gameServers.length} />}
      >
        {gameServers.length > 0 ? (
          <OptionItemGroup
            items={gameServers.map((server) => (
              <OptionItem
                key={server.name}
                title={server.name}
                description={server.ip}
                prefixElement={
                  <Image
                    src={server.iconSrc}
                    alt={server.name}
                    boxSize="28px"
                    style={{ borderRadius: "4px" }}
                  />
                }
              >
                {server.isQueried && (
                  <HStack>
                    {server.online && (
                      <Text fontSize="xs-sm" color="gray.500">
                        {`${server.playersOnline} / ${server.playersMax} ${t("InstanceWorldsPage.serverList.players")}`}
                      </Text>
                    )}
                    {server.online ? (
                      <Tag colorScheme="green">
                        <LuCheck />
                        <TagLabel ml={0.5}>
                          {t("InstanceWorldsPage.serverList.tag.online")}
                        </TagLabel>
                      </Tag>
                    ) : (
                      <Tag colorScheme="red">
                        <LuX />
                        <TagLabel ml={0.5}>
                          {t("InstanceWorldsPage.serverList.tag.offline")}
                        </TagLabel>
                      </Tag>
                    )}
                  </HStack>
                )}
              </OptionItem>
            ))}
          />
        ) : (
          <Empty withIcon={false} size="sm" />
        )}
      </Section>
    </>
  );
};

export default InstanceWorldsPage;

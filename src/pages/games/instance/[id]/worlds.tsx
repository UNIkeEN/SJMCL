import { Image } from "@chakra-ui/react";
import { HStack, Tag, TagLabel, Text } from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuX } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { GameServerInfo, WorldInfo } from "@/models/game-instance";
import { mockWorlds } from "@/models/mock/game-instance";
import { retriveGameServerList } from "@/services/instance";
import { formatRelativeTime } from "@/utils/datetime";

const InstanceWorldsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const accordionStates = config.states.instanceWorldsPage.accordionStates;
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [gameServers, setGameServers] = useState<GameServerInfo[]>([]);
  const { summary } = useInstanceSharedData();

  const handleRetriveGameServerList = useCallback(async () => {
    if (summary?.id) {
      setGameServers(await retriveGameServerList(summary.id, false)); // without online query, quickly get server list from local servers.dat to render
      setGameServers(await retriveGameServerList(summary.id, true));
    }
  }, [summary?.id]);

  useEffect(() => {
    setWorlds(mockWorlds);
    handleRetriveGameServerList();

    // refresh every minute to query server info
    const intervalId = setInterval(async () => {
      if (summary?.id) {
        setGameServers(await retriveGameServerList(summary.id, true));
      }
    }, 60000);
    return () => clearInterval(intervalId);
  }, [handleRetriveGameServerList, summary?.id]);

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

  const worldSecMenuOperations = [
    {
      icon: "openFolder",
      label: "",
      onClick: () => {},
    },
    {
      icon: "add",
      label: t("InstanceWorldsPage.worldList.add"),
      onClick: () => {},
    },
    {
      icon: "download",
      label: "",
      onClick: () => {},
    },
    {
      icon: "refresh",
      label: "",
      onClick: () => {},
    },
  ];
  const serverSecOperations = {
    icon: "refresh",
    onClick: handleRetriveGameServerList,
  };

  return (
    <>
      <Section
        isAccordion
        title={t("InstanceWorldsPage.worldList.title")}
        initialIsOpen={accordionStates[0]}
        titleExtra={<CountTag count={worlds.length} />}
        onAccordionToggle={(isOpen) => {
          update(
            "states.instanceWorldsPage.accordionStates",
            accordionStates.toSpliced(0, 1, isOpen)
          );
        }}
        headExtra={
          <HStack spacing={2}>
            {worldSecMenuOperations.map((btn, index) => (
              <CommonIconButton
                key={index}
                icon={btn.icon}
                label={btn.label}
                onClick={btn.onClick}
                size="xs"
                fontSize="sm"
                h={21}
              />
            ))}
          </HStack>
        }
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
        initialIsOpen={accordionStates[1]}
        titleExtra={<CountTag count={gameServers.length} />}
        onAccordionToggle={(isOpen) => {
          update(
            "states.instanceWorldsPage.accordionStates",
            accordionStates.toSpliced(1, 1, isOpen)
          );
        }}
        headExtra={
          <HStack spacing={2}>
            <CommonIconButton
              icon={serverSecOperations.icon}
              onClick={serverSecOperations.onClick}
              size="xs"
              fontSize="sm"
              h={21}
            />
          </HStack>
        }
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

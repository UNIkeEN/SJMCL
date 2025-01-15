import { IconButton, Image, Tooltip } from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFolderOpen } from "react-icons/lu";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { GameServerInfo, WorldInfo } from "@/models/game-instance";
import { mockGameserver, mockWorlds } from "@/models/mock/game-instance";
import { formatRelativeTime } from "@/utils/datetime";

const InstanceWorldsPage = () => {
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [gameServers, setGameServers] = useState<GameServerInfo[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    setWorlds(mockWorlds);
    setGameServers(mockGameserver);
  }, []);

  return (
    <>
      <Section isAccordion title={t("InstanceWorldsPage.worldList.title")}>
        {worlds.length > 0 ? (
          <OptionItemGroup
            items={worlds.map((world) => (
              <OptionItem
                key={world.name}
                title={world.name}
                description={`${t(
                  "InstanceWorldsPage.worldList.lastPlayedAt"
                )} ${formatRelativeTime(world.lastPlayedAt, t)}`}
                prefixElement={
                  <Image
                    src={world.iconUrl}
                    alt={world.name}
                    boxSize="28px"
                    style={{ borderRadius: "4px" }}
                  />
                }
              >
                <Tooltip label={t("General.openFolder")}>
                  <IconButton
                    aria-label={"open"}
                    icon={<LuFolderOpen />}
                    variant="ghost"
                    size="sm"
                    onClick={() => open(world.fileDir)}
                  />
                </Tooltip>
              </OptionItem>
            ))}
          />
        ) : (
          <Empty withIcon={false} size="sm" />
        )}
      </Section>

      <Section isAccordion title={t("InstanceWorldsPage.serverList.title")}>
        {gameServers.length > 0 ? (
          <OptionItemGroup
            items={gameServers.map((server) => (
              <OptionItem
                key={server.name}
                title={server.name}
                description={server.ip}
                prefixElement={
                  <Image
                    src={server.icon}
                    alt={server.name}
                    boxSize="28px"
                    style={{ borderRadius: "4px" }}
                  />
                }
              >
                <></>
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

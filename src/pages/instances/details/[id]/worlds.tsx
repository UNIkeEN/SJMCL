import {
  HStack,
  Image,
  Tag,
  TagLabel,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuX } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import WorldLevelDataModal from "@/components/modals/world-level-data-modal";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { InstanceSubdirType } from "@/enums/instance";
import { GameServerInfo } from "@/models/instance/misc";
import { WorldInfo } from "@/models/instance/world";
import { InstanceService } from "@/services/instance";
import { UNIXToISOString, formatRelativeTime } from "@/utils/datetime";
import { base64ImgSrc } from "@/utils/string";

const InstanceWorldsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const { summary, openInstanceSubdir, handleImportResource, getWorldList } =
    useInstanceSharedData();
  const accordionStates = config.states.instanceWorldsPage.accordionStates;
  const toast = useToast();
  const { openSharedModal } = useSharedModals();

  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [selectedWorldName, setSelectedWorldName] = useState<string>();
  const [gameServers, setGameServers] = useState<GameServerInfo[]>([]);

  const {
    isOpen: isWorldLevelDataModalOpen,
    onOpen: onWorldLevelDataModallOpen,
    onClose: onWorldLevelDataModalClose,
  } = useDisclosure();

  useEffect(() => {
    setWorlds(getWorldList() || []);
  }, [getWorldList]);

  const handleRetrieveGameServerList = useCallback(
    (queryOnline: boolean) => {
      if (summary?.id !== undefined) {
        InstanceService.retrieveGameServerList(summary.id, queryOnline).then(
          (response) => {
            if (response.status === "success") {
              setGameServers(response.data);
            } else if (!queryOnline) {
              toast({
                title: response.message,
                description: response.details,
                status: "error",
              });
            }
          }
        );
      }
    },
    [toast, summary?.id]
  );

  useEffect(() => {
    handleRetrieveGameServerList(false);
    handleRetrieveGameServerList(true);

    // refresh every minute to query server info
    const intervalId = setInterval(async () => {
      handleRetrieveGameServerList(true);
    }, 60000);
    return () => clearInterval(intervalId);
  }, [summary?.id, handleRetrieveGameServerList]);

  const worldSecMenuOperations = [
    {
      icon: "openFolder",
      onClick: () => {
        openInstanceSubdir(InstanceSubdirType.Saves);
      },
    },
    {
      icon: "add",
      onClick: () => {
        handleImportResource({
          filterName: t("InstanceDetailsLayout.instanceTabList.worlds"),
          filterExt: ["zip"],
          tgtDirType: InstanceSubdirType.Saves,
          decompress: true,
          onSuccessCallback: () => {
            setWorlds(getWorldList(true) || []);
          },
        });
      },
    },
    {
      icon: "download",
      onClick: () => {
        openSharedModal("download-resource", {
          initialResourceType: "world",
        });
      },
    },
    {
      icon: "refresh",
      onClick: () => {
        setWorlds(getWorldList(true) || []);
        setSelectedWorldName("");
      },
    },
  ];

  const worldItemMenuOperations = (save: WorldInfo) => [
    {
      label: "",
      icon: "copyOrMove",
      onClick: () => {
        openSharedModal("copy-or-move", {
          srcResName: save.name,
          srcFilePath: save.dirPath,
        });
      },
    },
    {
      label: "",
      icon: "revealFile",
      onClick: () => openPath(save.dirPath),
    },
    {
      label: t("InstanceWorldsPage.worldList.viewLevelData"),
      icon: "info",
      onClick: () => {
        setSelectedWorldName(save.name);
        onWorldLevelDataModallOpen();
      },
    },
  ];

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
                  )} ${formatRelativeTime(UNIXToISOString(world.lastPlayedAt), t)}${t("InstanceWorldsPage.worldList.moreDesc", { gamemode, difficulty })}`}
                  prefixElement={
                    <Image
                      src={convertFileSrc(world.iconSrc)}
                      fallbackSrc="/images/icons/UnknownWorld.webp"
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

      <WorldLevelDataModal
        instanceId={summary?.id}
        worldName={selectedWorldName || ""}
        isOpen={isWorldLevelDataModalOpen}
        onClose={onWorldLevelDataModalClose}
      />

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
          <CommonIconButton
            icon="refresh"
            onClick={() => {
              handleRetrieveGameServerList(false);
              handleRetrieveGameServerList(true);
            }}
            size="xs"
            fontSize="sm"
            h={21}
          />
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
                    src={
                      server.isQueried
                        ? server.iconSrc
                        : base64ImgSrc(server.iconSrc)
                    }
                    fallbackSrc="/images/icons/UnknownWorld.webp"
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

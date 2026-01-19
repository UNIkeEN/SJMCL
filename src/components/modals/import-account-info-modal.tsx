import {
  Box,
  Button,
  Center,
  Checkbox,
  Grid,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuTriangleAlert } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import Empty from "@/components/common/empty";
import { OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import SelectableCard from "@/components/common/selectable-card";
import PlayerAvatar from "@/components/player-avatar";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useToast } from "@/contexts/toast";
import { ImportLauncherType, PlayerType } from "@/enums/account";
import { AuthServer, Player } from "@/models/account";
import { AccountService } from "@/services/account";
import { generatePlayerDesc } from "@/utils/account";

interface ImportAccountInfoModalProps extends Omit<ModalProps, "children"> {
  currAuthServers?: AuthServer[];
  currPlayers?: Player[];
}

const ImportAccountInfoModal: React.FC<ImportAccountInfoModalProps> = ({
  currAuthServers,
  currPlayers,
  ...props
}) => {
  const toast = useToast();
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { getPlayerList } = useGlobalData();

  const [isRetrieving, setIsRetrieving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedType, setSelectedType] = useState<ImportLauncherType>(
    ImportLauncherType.HMCL
  );

  // new players and auth servers to be imported
  const [newAuthServers, setNewAuthServers] = useState<AuthServer[]>([]);
  const [newPlayers, setNewPlayers] = useState<Player[]>([]);

  // checkbox state
  const [serverChecked, setServerChecked] = useState<Record<string, boolean>>(
    {}
  );
  const [playerChecked, setPlayerChecked] = useState<Record<string, boolean>>(
    {}
  );

  const importLauncherTypes = [
    ImportLauncherType.HMCL,
    // ...(config.basicInfo.osType === "windows" ? [ImportLauncherType.PCL] : []),
    // ...(config.basicInfo.osType === "macos" ? [ImportLauncherType.SCL] : []),
  ];

  const isThirdParty = (p: Player) =>
    p.playerType === PlayerType.ThirdParty && !!p.authServer?.authUrl;

  const handleRetrieveOtherLauncherAccountInfo = useCallback(
    (type: ImportLauncherType) => {
      setIsRetrieving(true);
      AccountService.retrieveOtherLauncherAccountInfo(type)
        .then((res) => {
          if (res.status === "success") {
            const [players, authServers] = res.data;
            setNewPlayers(players);
            setNewAuthServers(authServers);

            // default: select all servers
            const nextServerChecked: Record<string, boolean> = {};
            authServers.forEach((s) => {
              nextServerChecked[s.authUrl] = true;
            });
            setServerChecked(nextServerChecked);

            // default: select all players that are allowed
            const nextPlayerChecked: Record<string, boolean> = {};
            players.forEach((p) => {
              const pid = String((p as any).id);
              if (isThirdParty(p)) {
                nextPlayerChecked[pid] =
                  !!nextServerChecked[p.authServer!.authUrl];
              } else {
                nextPlayerChecked[pid] = true;
              }
            });
            setPlayerChecked(nextPlayerChecked);
          } else {
            setNewPlayers([]);
            setNewAuthServers([]);
            setServerChecked({});
            setPlayerChecked({});
            toast({
              status: "error",
              title: res.message,
              description: res.details,
            });
          }
        })
        .finally(() => setIsRetrieving(false));
    },
    [toast]
  );

  useEffect(() => {
    if (!props.isOpen) return;
    handleRetrieveOtherLauncherAccountInfo(selectedType);
  }, [selectedType, handleRetrieveOtherLauncherAccountInfo, props.isOpen]);

  // if a server is unchecked, all its players MUST be unchecked
  useEffect(() => {
    setPlayerChecked((prev) => {
      let changed = false;
      const next = { ...prev };

      newPlayers.forEach((p) => {
        const pid = String((p as any).id);
        if (
          isThirdParty(p) &&
          !serverChecked[p.authServer!.authUrl] &&
          next[pid]
        ) {
          next[pid] = false;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [serverChecked, newPlayers]);

  const selectedAuthServers = newAuthServers.filter(
    (s) => serverChecked[s.authUrl]
  );

  const selectedPlayers = newPlayers.filter((p) => {
    const pid = String((p as any).id);
    if (!playerChecked[pid]) return false;

    if (isThirdParty(p)) {
      return !!serverChecked[p.authServer!.authUrl];
    }
    return true;
  });

  const handleImportExternalAccountInfo = useCallback(() => {
    setIsImporting(true);
    AccountService.importExternalAccountInfo(
      selectedPlayers,
      selectedAuthServers
    )
      .then((res) => {
        if (res.status === "success") {
          getPlayerList(true); // refresh player list
          toast({
            status: "success",
            title: res.message,
          });
          props.onClose && props.onClose();
        } else {
          toast({
            status: "error",
            title: res.message,
            description: res.details,
          });
        }
      })
      .finally(() => setIsImporting(false));
  }, [props, toast, getPlayerList, selectedPlayers, selectedAuthServers]);

  // check if auth server in curAuthServers
  const isInCurAuthServers = useCallback(
    (s: AuthServer) => {
      if (!currAuthServers) return false;
      return currAuthServers.some((cs) => cs.authUrl === s.authUrl);
    },
    [currAuthServers]
  );

  // check if player in curPlayers
  const isInCurPlayers = useCallback(
    (p: Player) => {
      if (!currPlayers) return false;
      return currPlayers.some(
        (cp) =>
          cp.uuid === p.uuid &&
          cp.playerType === p.playerType &&
          cp.authServer?.authUrl === p.authServer?.authUrl
      );
    },
    [currPlayers]
  );

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      {...props}
    >
      <ModalOverlay />
      <ModalContent h="80vh">
        <ModalHeader>{t("ImportAccountInfoModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody overflow="hidden">
          <Grid templateColumns={"3fr 5fr"} gap={4} h="100%">
            <VStack minW="3xs" spacing={3.5} overflowY="auto" align="stretch">
              {importLauncherTypes.map((type, index) => (
                <SelectableCard
                  key={index}
                  title={type}
                  description={t(`ImportAccountInfoModal.launcherDesc.${type}`)}
                  iconSrc={`/images/icons/external/${type}.png`}
                  displayMode="selector"
                  isSelected={selectedType === type}
                  onSelect={() => {
                    selectedType !== type && setSelectedType(type);
                  }}
                />
              ))}
            </VStack>
            <VStack overflow="auto" align="stretch" spacing={4} flex="1">
              {isRetrieving ? (
                <Center h="100%">
                  <BeatLoader size={16} color="gray" />
                </Center>
              ) : (
                <>
                  <Section title={t("ImportAccountInfoModal.body.authServers")}>
                    {newAuthServers.length === 0 ? (
                      <Center>
                        <Empty withIcon={false} size="sm" />
                      </Center>
                    ) : (
                      <OptionItemGroup
                        items={
                          newAuthServers.map((s) => ({
                            title: s.name,
                            description: s.authUrl,
                            prefixElement: (
                              <Checkbox
                                colorScheme={primaryColor}
                                isChecked={!!serverChecked[s.authUrl]}
                                onChange={(e) =>
                                  setServerChecked((prev) => ({
                                    ...prev,
                                    [s.authUrl]: e.target.checked,
                                  }))
                                }
                              />
                            ),
                            children: isInCurAuthServers(s) && (
                              <Tooltip
                                label={t(
                                  "ImportAccountInfoModal.tooltips.existingServer"
                                )}
                              >
                                <Box color="orange.500">
                                  <LuTriangleAlert />
                                </Box>
                              </Tooltip>
                            ),
                          })) || []
                        }
                      />
                    )}
                  </Section>
                  <Section title={t("ImportAccountInfoModal.body.players")}>
                    {newPlayers.length === 0 ? (
                      <Center>
                        <Empty withIcon={false} size="sm" />
                      </Center>
                    ) : (
                      <OptionItemGroup
                        items={newPlayers.map((p) => {
                          const pid = String(p.id);
                          const serverEnabled =
                            !isThirdParty(p) ||
                            !!serverChecked[p.authServer!.authUrl];

                          return {
                            title: p.name,
                            description: generatePlayerDesc(p, true),
                            prefixElement: (
                              <HStack spacing={3}>
                                <Checkbox
                                  colorScheme={primaryColor}
                                  isChecked={!!playerChecked[pid]}
                                  isDisabled={!serverEnabled}
                                  onChange={(e) =>
                                    setPlayerChecked((prev) => ({
                                      ...prev,
                                      [pid]: e.target.checked,
                                    }))
                                  }
                                />
                                <PlayerAvatar
                                  avatar={p.avatar}
                                  boxSize="32px"
                                />
                              </HStack>
                            ),
                            children: isInCurPlayers(p) && (
                              <Tooltip
                                label={t(
                                  "ImportAccountInfoModal.tooltips.existingPlayer"
                                )}
                              >
                                <Box color="orange.500">
                                  <LuTriangleAlert />
                                </Box>
                              </Tooltip>
                            ),
                          };
                        })}
                      />
                    )}
                  </Section>
                </>
              )}
            </VStack>
          </Grid>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={props.onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            colorScheme={primaryColor}
            isLoading={isImporting}
            isDisabled={
              isRetrieving ||
              isImporting ||
              (selectedAuthServers.length === 0 && selectedPlayers.length === 0)
            }
            onClick={handleImportExternalAccountInfo}
          >
            {t("General.import")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ImportAccountInfoModal;

import {
  Badge,
  Button,
  Center,
  HStack,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Tag,
  TagLabel,
  Text,
  VStack,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCheck,
  LuClock3,
  LuExternalLink,
  LuRefreshCcw,
  LuUndo2,
  LuUserRoundMinus,
  LuUserRoundPlus,
  LuX,
} from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { OptionItemGroup } from "@/components/common/option-item";
import PlayerAvatar from "@/components/player-avatar";
import { useLauncherConfig } from "@/contexts/config";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import {
  MicrosoftFriendAction,
  MicrosoftFriendPresenceStatus,
  PlayerType,
} from "@/enums/account";
import { MicrosoftFriend, MicrosoftFriendList, Player } from "@/models/account";
import { AccountService } from "@/services/account";

interface MicrosoftFriendsModalProps extends Omit<ModalProps, "children"> {
  curPlayer: Player;
}

const FRIEND_LIST_REFRESH_INTERVAL_MS = 60 * 1000;

const MicrosoftFriendsModal: React.FC<MicrosoftFriendsModalProps> = ({
  curPlayer,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const { openGenericConfirmDialog } = useSharedModals();
  const primaryColor = config.appearance.theme.primaryColor;

  const [friendList, setFriendList] = useState<MicrosoftFriendList>();
  const [newFriendName, setNewFriendName] = useState("");
  const [isListLoading, setIsListLoading] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [pendingActionKey, setPendingActionKey] = useState<string>();

  const trimmedNewFriendName = newFriendName.trim();
  const isOperating = isAddingFriend || !!pendingActionKey;

  const getFriendStatusValue = useCallback((friend: MicrosoftFriend) => {
    if (friend.invited) {
      return "INVITED";
    }

    return friend.status || MicrosoftFriendPresenceStatus.Offline;
  }, []);

  const getFriendStatusLabel = useCallback(
    (friend: MicrosoftFriend) =>
      t(`MicrosoftFriendsModal.status.${getFriendStatusValue(friend)}`),
    [getFriendStatusValue, t]
  );

  const getFriendStatusColorScheme = useCallback(
    (friend: MicrosoftFriend) => {
      switch (getFriendStatusValue(friend)) {
        case "INVITED":
          return "yellow";
        case MicrosoftFriendPresenceStatus.Online:
        case MicrosoftFriendPresenceStatus.PlayingOffline:
        case MicrosoftFriendPresenceStatus.PlayingRealms:
        case MicrosoftFriendPresenceStatus.PlayingServer:
        case MicrosoftFriendPresenceStatus.PlayingHostedServer:
          return "green";
        default:
          return "gray";
      }
    },
    [getFriendStatusValue]
  );

  const handleRetrieveMicrosoftFriendList = useCallback(
    (isSilent = false) => {
      if (!isSilent) {
        setIsListLoading(true);
      }

      AccountService.retrieveMicrosoftFriendList(curPlayer.id)
        .then((response) => {
          if (response.status === "success") {
            setFriendList(response.data);
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        })
        .finally(() => {
          if (!isSilent) {
            setIsListLoading(false);
          }
        });
    },
    [curPlayer.id, toast]
  );

  const handleUpdateMicrosoftFriend = useCallback(
    (
      tgtPlayerName: string,
      tgtPlayerUuid: string | undefined,
      action: MicrosoftFriendAction
    ) => {
      const actionKey = `${action}:${tgtPlayerUuid || tgtPlayerName}`;

      if (action === MicrosoftFriendAction.Add) {
        setIsAddingFriend(true);
      } else {
        setPendingActionKey(actionKey);
      }

      AccountService.updateMicrosoftFriend(
        curPlayer.id,
        tgtPlayerName,
        tgtPlayerUuid,
        action
      )
        .then((response) => {
          if (response.status === "success") {
            setFriendList(response.data);
            toast({
              title: response.message,
              status: "success",
            });
            if (action === MicrosoftFriendAction.Add) {
              setNewFriendName("");
            }
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        })
        .finally(() => {
          if (action === MicrosoftFriendAction.Add) {
            setIsAddingFriend(false);
          } else {
            setPendingActionKey(undefined);
          }
        });
    },
    [curPlayer.id, toast]
  );

  const handleAddFriend = useCallback(() => {
    if (!trimmedNewFriendName) return;
    handleUpdateMicrosoftFriend(
      trimmedNewFriendName,
      undefined,
      MicrosoftFriendAction.Add
    );
  }, [trimmedNewFriendName, handleUpdateMicrosoftFriend]);

  useEffect(() => {
    if (modalProps.isOpen) {
      setNewFriendName("");
      setPendingActionKey(undefined);
      handleRetrieveMicrosoftFriendList();
    }
  }, [modalProps.isOpen, handleRetrieveMicrosoftFriendList]);

  useEffect(() => {
    if (!modalProps.isOpen) return;

    const intervalId = window.setInterval(() => {
      if (!isOperating && !isListLoading) {
        handleRetrieveMicrosoftFriendList(true);
      }
    }, FRIEND_LIST_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [
    handleRetrieveMicrosoftFriendList,
    isListLoading,
    isOperating,
    modalProps.isOpen,
  ]);

  const inviteItems = useMemo(() => {
    if (!friendList) return [];

    const incomingItems = friendList.incomingRequests.map((friend) => ({
      title: friend.name,
      description: t("MicrosoftFriendsModal.request.incoming"),
      prefixElement: (
        <HStack spacing={0}>
          <PlayerAvatar
            avatar={friend.avatar}
            boxSize="32px"
            objectFit="cover"
          />
        </HStack>
      ),
      children: (
        <HStack spacing={0.5}>
          <CommonIconButton
            icon={LuCheck}
            label={t("MicrosoftFriendsModal.button.accept")}
            colorScheme="green"
            isDisabled={isOperating || isListLoading}
            isLoading={
              pendingActionKey ===
              `${MicrosoftFriendAction.Accept}:${friend.profileId}`
            }
            onClick={() =>
              handleUpdateMicrosoftFriend(
                friend.name,
                friend.profileId,
                MicrosoftFriendAction.Accept
              )
            }
          />
          <CommonIconButton
            icon={LuX}
            label={t("MicrosoftFriendsModal.button.decline")}
            colorScheme="red"
            isDisabled={isOperating || isListLoading}
            isLoading={
              pendingActionKey ===
              `${MicrosoftFriendAction.Decline}:${friend.profileId}`
            }
            onClick={() =>
              handleUpdateMicrosoftFriend(
                friend.name,
                friend.profileId,
                MicrosoftFriendAction.Decline
              )
            }
          />
        </HStack>
      ),
    }));

    const outgoingItems = friendList.outgoingRequests.map((friend) => ({
      title: friend.name,
      description: t("MicrosoftFriendsModal.request.outgoing"),
      prefixElement: (
        <HStack spacing={0}>
          <PlayerAvatar
            avatar={friend.avatar}
            boxSize="32px"
            objectFit="cover"
          />
        </HStack>
      ),
      children: (
        <CommonIconButton
          icon={LuUndo2}
          label={t("MicrosoftFriendsModal.button.revoke")}
          isDisabled={isOperating || isListLoading}
          isLoading={
            pendingActionKey ===
            `${MicrosoftFriendAction.Revoke}:${friend.profileId}`
          }
          onClick={() =>
            handleUpdateMicrosoftFriend(
              friend.name,
              friend.profileId,
              MicrosoftFriendAction.Revoke
            )
          }
        />
      ),
    }));

    return [...incomingItems, ...outgoingItems];
  }, [
    friendList,
    handleUpdateMicrosoftFriend,
    isListLoading,
    isOperating,
    pendingActionKey,
    t,
  ]);

  const friendItems = useMemo(() => {
    if (!friendList) return [];

    return friendList.friends.map((friend) => ({
      title: friend.name,
      prefixElement: (
        <HStack spacing={0}>
          <PlayerAvatar
            avatar={friend.avatar}
            boxSize="32px"
            objectFit="cover"
          />
        </HStack>
      ),
      children: (
        <HStack spacing={2}>
          <Tag colorScheme={getFriendStatusColorScheme(friend)}>
            <HStack spacing={0.5}>
              {getFriendStatusValue(friend) === "INVITED" ? (
                <LuClock3 />
              ) : getFriendStatusValue(friend) ===
                MicrosoftFriendPresenceStatus.Offline ? (
                <LuX />
              ) : (
                <LuCheck />
              )}
              <TagLabel>{getFriendStatusLabel(friend)}</TagLabel>
            </HStack>
          </Tag>
          <CommonIconButton
            icon={LuUserRoundMinus}
            label={t("MicrosoftFriendsModal.button.remove")}
            colorScheme="red"
            isDisabled={isOperating || isListLoading}
            isLoading={
              pendingActionKey ===
              `${MicrosoftFriendAction.Remove}:${friend.profileId}`
            }
            onClick={() =>
              openGenericConfirmDialog({
                title: t("DeleteGameFriendDialog.dialog.title"),
                body: t("DeleteGameFriendDialog.dialog.content", {
                  name: friend.name,
                }),
                btnOK: t("General.delete"),
                isAlert: true,
                onOKCallback: () =>
                  handleUpdateMicrosoftFriend(
                    friend.name,
                    friend.profileId,
                    MicrosoftFriendAction.Remove
                  ),
              })
            }
          />
        </HStack>
      ),
    }));
  }, [
    friendList,
    getFriendStatusColorScheme,
    getFriendStatusLabel,
    getFriendStatusValue,
    handleUpdateMicrosoftFriend,
    isListLoading,
    isOperating,
    openGenericConfirmDialog,
    pendingActionKey,
    t,
  ]);

  if (curPlayer.playerType !== PlayerType.Microsoft) {
    return null;
  }

  return (
    <Modal
      size={{ base: "lg", xl: "2xl" }}
      scrollBehavior="inside"
      returnFocusOnClose={false}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
        <ModalHeader>
          <HStack>
            <Text>
              {t("MicrosoftFriendsModal.title", { name: curPlayer.name })}
            </Text>
            <Badge colorScheme="purple">Beta</Badge>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody overflow="hidden">
          <VStack h="100%" minH={0} spacing={4} align="stretch">
            <HStack align="stretch">
              <Input
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                placeholder={t("MicrosoftFriendsModal.placeholder.playerName")}
                focusBorderColor={`${primaryColor}.500`}
                isDisabled={isOperating}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    trimmedNewFriendName &&
                    !isOperating
                  ) {
                    handleAddFriend();
                  }
                }}
              />
              <Button
                colorScheme={primaryColor}
                isLoading={isAddingFriend}
                isDisabled={!trimmedNewFriendName || isOperating}
                onClick={handleAddFriend}
              >
                <HStack spacing={1.5}>
                  <LuUserRoundPlus />
                  <Text>{t("MicrosoftFriendsModal.button.add")}</Text>
                </HStack>
              </Button>
              <CommonIconButton
                icon={LuRefreshCcw}
                label={t("General.refresh")}
                onClick={() => handleRetrieveMicrosoftFriendList()}
                isLoading={isListLoading}
                isDisabled={isOperating}
              />
            </HStack>

            {isListLoading ? (
              <Center flex={1} minH={0}>
                <BeatLoader size={16} color="gray" />
              </Center>
            ) : (
              <VStack
                flex={1}
                minH={0}
                overflowY="auto"
                spacing={4}
                align="stretch"
              >
                <OptionItemGroup
                  title={t("MicrosoftFriendsModal.group.requests")}
                  items={
                    inviteItems.length > 0
                      ? inviteItems
                      : [
                          <Text
                            key="empty-invites"
                            fontSize="sm"
                            className="secondary-text"
                          >
                            {t("MicrosoftFriendsModal.empty.requests")}
                          </Text>,
                        ]
                  }
                />

                <OptionItemGroup
                  title={t("MicrosoftFriendsModal.group.friends")}
                  items={
                    friendItems.length > 0
                      ? friendItems
                      : [
                          <Text
                            key="empty-friends"
                            fontSize="sm"
                            className="secondary-text"
                          >
                            {t("MicrosoftFriendsModal.empty.friends")}
                          </Text>,
                        ]
                  }
                />
              </VStack>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter w="100%">
          <HStack spacing={2}>
            <LuExternalLink />
            <Link
              color={`${primaryColor}.500`}
              onClick={() => {
                openUrl("https://aka.ms/MinecraftJavaXboxPrivacyAndSafety");
              }}
            >
              {t("MicrosoftFriendsModal.button.xboxSettings")}
            </Link>
          </HStack>

          <HStack spacing={3} ml="auto">
            <Button variant="ghost" onClick={modalProps.onClose}>
              {t("General.close")}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default MicrosoftFriendsModal;

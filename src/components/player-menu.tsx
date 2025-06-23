import {
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Spinner,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCopy, LuEllipsis, LuRefreshCcw, LuTrash } from "react-icons/lu";
import { TbHanger } from "react-icons/tb";
import { CommonIconButton } from "@/components/common/common-icon-button";
import ManageSkinModal from "@/components/modals/manage-skin-modal";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { PlayerType } from "@/enums/account";
import { AccountServiceError } from "@/enums/service-error";
import { Player } from "@/models/account";
import { AccountService } from "@/services/account";
import { copyText } from "@/utils/copy";
import ViewSkinModal from "./modals/view-skin-modal";

interface PlayerMenuProps {
  player: Player;
  variant?: "dropdown" | "buttonGroup";
}

export const PlayerMenu: React.FC<PlayerMenuProps> = ({
  player,
  variant = "dropdown",
}) => {
  const { t } = useTranslation();
  const { refreshConfig } = useLauncherConfig();
  const toast = useToast();
  const { getPlayerList } = useGlobalData();
  const { openSharedModal, closeSharedModal, openGenericConfirmDialog } =
    useSharedModals();

  const {
    isOpen: isSkinModalOpen,
    onOpen: onSkinModalOpen,
    onClose: onSkinModalClose,
  } = useDisclosure();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeletePlayer = () => {
    setIsDeleting(true);
    AccountService.deletePlayer(player.id).then((response) => {
      if (response.status === "success") {
        Promise.all([getPlayerList(true), refreshConfig()]);
        toast({
          title: response.message,
          status: "success",
        });
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
      setIsDeleting(false);
      closeSharedModal("generic-confirm");
    });
  };

  const handleRefreshPlayer = () => {
    setIsRefreshing(true);
    AccountService.refreshPlayer(player.id)
      .then((response) => {
        if (response.status === "success") {
          Promise.all([getPlayerList(true), refreshConfig()]);
          toast({
            title: response.message,
            status: "success",
          });
        } else {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
          if (response.raw_error === AccountServiceError.Expired) {
            openSharedModal("relogin", {
              player,
              onSuccess: () => {
                Promise.all([getPlayerList(true), refreshConfig()]);
              },
            });
          }
        }
      })
      .finally(() => setIsRefreshing(false));
  };

  const playerMenuOperations = [
    ...(player.playerType === PlayerType.Offline
      ? []
      : [
          {
            icon: LuRefreshCcw,
            label: t("General.refresh"),
            onClick: handleRefreshPlayer,
            isLoading: isRefreshing,
          },
        ]),
    {
      icon: TbHanger,
      label: t(
        `PlayerMenu.label.${player.playerType === PlayerType.Offline ? "manageSkin" : "viewSkin"}`
      ),
      onClick: onSkinModalOpen,
    },
    {
      icon: LuCopy,
      label: t("PlayerMenu.label.copyUUID"),
      onClick: () => copyText(player.uuid, { toast }),
    },
    {
      icon: LuTrash,
      label: t("PlayerMenu.label.delete"),
      danger: true,
      onClick: () => {
        openGenericConfirmDialog({
          title: t("DeletePlayerAlertDialog.dialog.title"),
          body: t("DeletePlayerAlertDialog.dialog.content", {
            name: player.name,
          }),
          btnOK: t("General.delete"),
          isAlert: true,
          onOKCallback: handleDeletePlayer,
          showSuppressBtn: true,
          suppressKey: "deletePlayerAlert",
        });
      },
    },
  ];

  return (
    <>
      {variant === "dropdown" ? (
        <Menu>
          <MenuButton
            as={IconButton}
            size="xs"
            variant="ghost"
            aria-label="operations"
            icon={<LuEllipsis />}
          />
          <Portal>
            <MenuList>
              {playerMenuOperations.map((item) => (
                <MenuItem
                  key={item.label}
                  fontSize="xs"
                  color={item.danger ? "red.500" : "inherit"}
                  onClick={item.onClick}
                >
                  <HStack>
                    {item.isLoading ? <Spinner /> : <item.icon />}
                    <Text>{item.label}</Text>
                  </HStack>
                </MenuItem>
              ))}
            </MenuList>
          </Portal>
        </Menu>
      ) : (
        <HStack spacing={0}>
          {playerMenuOperations.map((item) => (
            <CommonIconButton
              key={item.label}
              icon={item.icon}
              label={item.label}
              colorScheme={item.danger ? "red" : "gray"}
              onClick={item.onClick}
              isLoading={item.isLoading}
            />
          ))}
        </HStack>
      )}
      {player.playerType === PlayerType.Offline ? (
        <ManageSkinModal
          isOpen={isSkinModalOpen}
          onClose={onSkinModalClose}
          playerId={player.id}
          skin={player.textures.find(
            (texture) => texture.textureType === "SKIN"
          )}
          cape={player.textures.find(
            (texture) => texture.textureType === "CAPE"
          )}
        />
      ) : (
        <ViewSkinModal
          isOpen={isSkinModalOpen}
          onClose={onSkinModalClose}
          skin={player.textures.find(
            (texture) => texture.textureType === "SKIN"
          )}
          cape={player.textures.find(
            (texture) => texture.textureType === "CAPE"
          )}
        />
      )}
    </>
  );
};

export default PlayerMenu;

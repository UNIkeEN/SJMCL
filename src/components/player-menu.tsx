import {
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuEllipsis, LuTrash } from "react-icons/lu";
import { TbHanger } from "react-icons/tb";
import { CommonIconButton } from "@/components/common/common-icon-button";
import GenericConfirmDialog from "@/components/modals/generic-confirm-dialog";
import ManageSkinModal from "@/components/modals/manage-skin-modal";
import { useData } from "@/contexts/data";
import { useToast } from "@/contexts/toast";
import { Player } from "@/models/account";
import { AccountService } from "@/services/account";
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
  const toast = useToast();
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  const {
    isOpen: isSkinModalOpen,
    onOpen: onSkinModalOpen,
    onClose: onSkinModalClose,
  } = useDisclosure();
  const { getPlayerList, getSelectedPlayer } = useData();

  const handleDeletePlayer = () => {
    AccountService.deletePlayer(player.uuid).then((response) => {
      if (response.status === "success") {
        getPlayerList(true);
        getSelectedPlayer(true);
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
      onDeleteClose();
    });
  };

  const playerMenuOperations = [
    {
      icon: TbHanger,
      label: t(
        `PlayerMenu.label.${player.playerType === "offline" ? "manageSkin" : "viewSkin"}`
      ),
      onClick: onSkinModalOpen,
    },
    {
      icon: LuTrash,
      label: t("PlayerMenu.label.delete"),
      danger: true,
      onClick: () => {
        onDeleteOpen();
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
                    <item.icon />
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
            />
          ))}
        </HStack>
      )}

      <GenericConfirmDialog
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        title={t("DeletePlayerAlertDialog.dialog.title")}
        body={t("DeletePlayerAlertDialog.dialog.content", {
          name: player.name,
        })}
        btnOK={t("General.delete")}
        btnCancel={t("General.cancel")}
        onOKCallback={handleDeletePlayer}
        isAlert
      />
      {player.playerType === "offline" ? (
        <ManageSkinModal
          isOpen={isSkinModalOpen}
          onClose={onSkinModalClose}
          playerId={player.uuid}
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

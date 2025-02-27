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
import { open } from "@tauri-apps/plugin-shell";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  LuEllipsis,
  LuFolderOpen,
  LuLayoutList,
  LuTrash,
} from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import GenericConfirmDialog from "@/components/modals/generic-confirm-dialog";
import { GameInstanceSummary } from "@/models/instance";

interface GameMenuProps {
  game: GameInstanceSummary;
  variant?: "dropdown" | "buttonGroup";
}

export const GameMenu: React.FC<GameMenuProps> = ({
  game,
  variant = "dropdown",
}) => {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();

  const handleDelete = () => {
    onDeleteClose();
  };

  const gameMenuOperations = [
    {
      icon: LuFolderOpen,
      label: t("General.openFolder"),
      onClick: () => {
        open(game.versionPath);
      },
    },
    {
      icon: LuLayoutList,
      label: t("GameMenu.label.details"),
      onClick: () => {
        router.push(`/games/instance/${game.id}`);
      },
    },
    {
      icon: LuTrash,
      label: t("GameMenu.label.delete"),
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
              {gameMenuOperations.map((item) => (
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
          {gameMenuOperations.map((item) => (
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
        title={t("DeleteGameInstanceAlertDialog.dialog.title")}
        body={t("DeleteGameInstanceAlertDialog.dialog.content", {
          gameName: game.name,
        })}
        btnOK={t("General.delete")}
        btnCancel={t("General.cancel")}
        onOKCallback={handleDelete}
        isAlert
      />
    </>
  );
};

export default GameMenu;

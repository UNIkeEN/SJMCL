import {
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  Tooltip,
  useDisclosure,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";
import { LuEllipsis, LuLayoutList, LuTrash } from "react-icons/lu";
import GenericConfirmDialog from "@/components/modals/generic-confirm-dialog";
import { GameInstanceSummary } from "@/models/game-instance";

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
    console.log(`${game.id}`);
    onDeleteClose();
  };

  const gameMenuOperations = [
    {
      key: "details",
      icon: LuLayoutList,
      onClick: () => {
        router.push(`/games/instance/${game.id}`);
      },
    },
    {
      key: "delete",
      icon: LuTrash,
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
          <MenuList>
            {gameMenuOperations.map((item) => (
              <MenuItem
                key={item.key}
                fontSize="xs"
                color={item.danger ? "red.500" : "inherit"}
                onClick={item.onClick}
              >
                <HStack>
                  <item.icon />
                  <Text>{t(`GameMenu.label.${item.key}`)}</Text>
                </HStack>
              </MenuItem>
            ))}
          </MenuList>
        </Menu>
      ) : (
        <HStack spacing={0}>
          {gameMenuOperations.map((item) => (
            <Tooltip label={t(`GameMenu.label.${item.key}`)} key={item.key}>
              <IconButton
                size="sm"
                aria-label={item.key}
                icon={<item.icon />}
                variant="ghost"
                colorScheme={item.danger ? "red" : "gray"}
                onClick={item.onClick}
              />
            </Tooltip>
          ))}
        </HStack>
      )}
      <GenericConfirmDialog
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        title={t("DeleteGameAlertDialog.dialog.title")}
        body={t("DeleteGameAlertDialog.dialog.content", {
          gameName: game.name,
        })}
        btnOK={t("GenericConfirmModal.Button.delete")}
        btnCancel={t("GenericConfirmModal.Button.cancel")}
        onOKCallback={handleDelete}
        isAlert
      />
    </>
  );
};

export default GameMenu;

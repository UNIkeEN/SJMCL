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
import { useTranslation } from "react-i18next";
import { LuEllipsis, LuTrash } from "react-icons/lu";
import { TbHanger } from "react-icons/tb";
import GenericConfirmDialog from "@/components/modals/generic-confirm-dialog";
import { useData, useDataDispatch } from "@/contexts/data";
import { useToast } from "@/contexts/toast";
import { Player } from "@/models/account";
import { deletePlayer, getPlayerList } from "@/services/account";

interface PlayerMenuProps {
  player: Player;
  variant?: "dropdown" | "buttonGroup";
}

export const PlayerMenu: React.FC<PlayerMenuProps> = ({
  player,
  variant = "dropdown",
}) => {
  const { t } = useTranslation();
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  const { selectedPlayer } = useData();
  const { setPlayerList, setSelectedPlayer } = useDataDispatch();
  const toast = useToast();

  const handleDelete = () => {
    (async () => {
      try {
        let uuid = player.uuid;
        await deletePlayer(uuid);
        const players = await getPlayerList();
        setPlayerList(players);
        if (selectedPlayer?.uuid === uuid) {
          setSelectedPlayer(undefined);
        }
        toast({
          title: t("Services.account.deletePlayer.success"),
          status: "success",
        });
      } catch (error) {
        toast({
          title: t("Services.account.deletePlayer.error"),
          status: "error",
        });
      } finally {
        onDeleteClose();
      }
    })();
  };

  const playerMenuOperations = [
    {
      key: "skin",
      icon: TbHanger,
      onClick: () => {
        console.log("Skin operation clicked");
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
            {playerMenuOperations.map((item) => (
              <MenuItem
                key={item.key}
                fontSize="xs"
                color={item.danger ? "red.500" : "inherit"}
                onClick={item.onClick}
              >
                <HStack>
                  <item.icon />
                  <Text>{t(`PlayerMenu.label.${item.key}`)}</Text>
                </HStack>
              </MenuItem>
            ))}
          </MenuList>
        </Menu>
      ) : (
        <HStack spacing={0}>
          {playerMenuOperations.map((item) => (
            <Tooltip label={t(`PlayerMenu.label.${item.key}`)} key={item.key}>
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
        title={t("DeletePlayerAlertDialog.dialog.title")}
        body={t("DeletePlayerAlertDialog.dialog.content", {
          name: player.name,
        })}
        btnOK={t("GenericConfirmModal.Button.delete")}
        btnCancel={t("GenericConfirmModal.Button.cancel")}
        onOKCallback={handleDelete}
        isAlert
      />
    </>
  );
};

export default PlayerMenu;

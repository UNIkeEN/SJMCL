import { HStack, Icon, Switch, useDisclosure } from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import { useRouter } from "next/router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFolder } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import {
  OptionItemGroup,
  OptionItemGroupProps,
  OptionItemProps,
} from "@/components/common/option-item";
import GameSettingsGroups from "@/components/game-settings-groups";
import EditGameDirectoryModal from "@/components/modals/edit-game-directory-modal";
import GenericConfirmDialog from "@/components/modals/generic-confirm-dialog";
import { useLauncherConfig } from "@/contexts/config";
import { useData } from "@/contexts/data";
import { GameDirectory } from "@/models/config";

const GlobalGameSettingsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const globalGameConfigs = config.globalGameConfig;
  const { getGameInstanceList } = useData();

  const router = useRouter();
  const { id } = router.query;
  const instanceId = Array.isArray(id) ? id[0] : id;

  const [selectedDir, setSelectedDir] = useState<GameDirectory>({
    name: "",
    dir: "",
  });

  const {
    isOpen: isDeleteDirDialogOpen,
    onOpen: onDeleteDirDialogOpen,
    onClose: onDeleteDirDialogClose,
  } = useDisclosure();

  const {
    isOpen: isAddDirModalOpen,
    onOpen: onAddDirModalOpen,
    onClose: onAddDirModalClose,
  } = useDisclosure();

  const {
    isOpen: isEditDirModalOpen,
    onOpen: onEditDirModalOpen,
    onClose: onEditDirModalClose,
  } = useDisclosure();

  const handleDeleteDir = () => {
    update(
      "localGameDirectories",
      config.localGameDirectories.filter((dir) => dir.dir !== selectedDir.dir)
    );
    getGameInstanceList(true); // refresh frontend state of instance list
    onDeleteDirDialogClose();
  };

  const dirItemMenuOperations = (directory: GameDirectory) => [
    {
      icon: "openFolder",
      danger: false,
      onClick: () => {
        open(directory.dir);
      },
    },
    ...(directory.name !== "CURRENT_DIR"
      ? [
          {
            icon: "edit",
            danger: false,
            onClick: () => {
              setSelectedDir(directory);
              onEditDirModalOpen();
            },
          },
          {
            icon: "delete",
            danger: true,
            onClick: () => {
              setSelectedDir(directory);
              onDeleteDirDialogOpen();
            },
          },
        ]
      : []),
  ];

  const globalSpecSettingsGroups: OptionItemGroupProps[] = [
    {
      title: t("GlobalGameSettingsPage.directories.title"),
      headExtra: (
        <CommonIconButton
          icon="add"
          size="xs"
          fontSize="sm"
          h={21}
          onClick={onAddDirModalOpen}
        />
      ),
      items: [
        ...config.localGameDirectories.map(
          (directory) =>
            ({
              title: ["CURRENT_DIR", "OFFICIAL_DIR"].includes(directory.name)
                ? t(
                    `GlobalGameSettingsPage.directories.settings.directories.special.${directory.name}`
                  )
                : directory.name,
              description: directory.dir,
              prefixElement: <Icon as={LuFolder} boxSize={3.5} mx={1} />,
              children: (
                <HStack spacing={0}>
                  {dirItemMenuOperations(directory).map((item, index) => (
                    <CommonIconButton
                      key={index}
                      icon={item.icon}
                      colorScheme={item.danger ? "red" : "gray"}
                      onClick={item.onClick}
                    />
                  ))}
                </HStack>
              ),
            }) as OptionItemProps
        ),
        {
          title: t("GlobalGameSettingsPage.versionIsolation.settings.title"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={globalGameConfigs.versionIsolation}
              onChange={(event) => {
                update(
                  "globalGameConfig.versionIsolation",
                  event.target.checked
                );
              }}
            />
          ),
        },
      ],
    },
  ];

  return (
    <>
      {/* Game directory list */}
      {globalSpecSettingsGroups.map((group, index) => (
        <OptionItemGroup {...group} key={index} />
      ))}

      <EditGameDirectoryModal
        isOpen={isAddDirModalOpen}
        onClose={onAddDirModalClose}
        add
      />
      <EditGameDirectoryModal
        isOpen={isEditDirModalOpen}
        onClose={onEditDirModalClose}
        currentName={selectedDir.name}
        currentPath={selectedDir.dir}
      />
      <GenericConfirmDialog
        isAlert
        isOpen={isDeleteDirDialogOpen}
        onClose={onDeleteDirDialogClose}
        title={t("GlobalGameSettingsPage.directories.deleteDialog.title")}
        body={t("GlobalGameSettingsPage.directories.deleteDialog.content", {
          dirName:
            selectedDir.name === "OFFICIAL_DIR"
              ? t(
                  "GlobalGameSettingsPage.directories.settings.directories.special.OFFICIAL_DIR"
                )
              : selectedDir.name,
        })}
        btnOK={t("General.delete")}
        btnCancel={t("General.cancel")}
        onOKCallback={handleDeleteDir}
      />

      {/* Game config option-items */}
      <GameSettingsGroups />
    </>
  );
};

export default GlobalGameSettingsPage;

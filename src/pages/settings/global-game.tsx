import { HStack, Icon, Switch, Text, useDisclosure } from "@chakra-ui/react";
import { exists } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-shell";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFolder, LuFolderX } from "react-icons/lu";
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

  const [directoryStatus, setDirectoryStatus] = useState<
    Record<string, boolean>
  >({});

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

  useEffect(() => {
    const checkDirectories = async () => {
      const status: Record<string, boolean> = {};
      for (const directory of config.localGameDirectories) {
        if (["CURRENT_DIR", "OFFICIAL_DIR"].includes(directory.name)) {
          continue;
        }

        try {
          const dirExists = await exists(directory.dir);
          status[directory.dir] = dirExists;
        } catch (error) {
          console.error(`Error checking directory ${directory.dir}:`, error);
          status[directory.dir] = false;
        }
      }
      setDirectoryStatus(status);
    };

    checkDirectories();
  }, [config.localGameDirectories]);

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
              description: (
                <Text fontSize="xs" color="gray.500">
                  {directory.dir}
                  {!["CURRENT_DIR", "OFFICIAL_DIR"].includes(directory.name) &&
                    directoryStatus[directory.dir] === false && ( // 仅检查用户添加的文件夹
                      <Text color="red.500" fontSize="xs">
                        {t(
                          "GlobalGameSettingsPage.directories.directoryNotExist"
                        )}
                      </Text>
                    )}
                </Text>
              ),
              prefixElement: (
                <Icon
                  as={
                    ["CURRENT_DIR", "OFFICIAL_DIR"].includes(directory.name) ||
                    directoryStatus[directory.dir]
                      ? LuFolder
                      : LuFolderX
                  }
                  boxSize={3.5}
                  mx={1}
                />
              ),
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

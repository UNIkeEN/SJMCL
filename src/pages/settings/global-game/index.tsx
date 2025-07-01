import {
  HStack,
  Icon,
  Switch,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { exists } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
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
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useRoutingHistory } from "@/contexts/routing-history";
import { useSharedModals } from "@/contexts/shared-modal";
import { GameDirectory } from "@/models/config";
import { getGameDirName, isSpecialGameDir } from "@/utils/instance";

const GlobalGameSettingsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const globalGameConfigs = config.globalGameConfig;
  const { getInstanceList } = useGlobalData();
  const { removeHistory } = useRoutingHistory();
  const { closeSharedModal, openGenericConfirmDialog } = useSharedModals();

  const [selectedDir, setSelectedDir] = useState<GameDirectory>({
    name: "",
    dir: "",
  });

  const [directoryExistence, setDirectoryExistence] = useState<
    Record<string, boolean>
  >({});

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
      const existence: Record<string, boolean> = {};
      for (const directory of config.localGameDirectories) {
        if (isSpecialGameDir(directory.name)) {
          existence[directory.dir] = true;
          continue;
        }
        try {
          const dirExistence = await exists(directory.dir);
          existence[directory.dir] = dirExistence;
        } catch (error) {
          existence[directory.dir] = false;
        }
      }
      setDirectoryExistence(existence);
    };

    checkDirectories();
  }, [config.localGameDirectories]);

  const handleDeleteDir = (selectedDir: GameDirectory) => {
    update(
      "localGameDirectories",
      config.localGameDirectories.filter((dir) => dir.dir !== selectedDir.dir)
    );
    getInstanceList(true); // refresh frontend state of instance list
    removeHistory(`/instances/details/${selectedDir.name}:`);
    removeHistory(`/instances/list/${selectedDir.name}`);
    closeSharedModal("generic-confirm");
  };

  const dirItemMenuOperations = (directory: GameDirectory) => [
    {
      icon: "openFolder",
      danger: false,
      onClick: () => {
        openPath(directory.dir);
      },
      disabled: !directoryExistence[directory.dir],
    },
    ...(directory.name !== "CURRENT_DIR" && directory.name !== "APP_DATA_SUBDIR"
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
              openGenericConfirmDialog({
                title: t(
                  "GlobalGameSettingsPage.directories.deleteDialog.title"
                ),
                body: t(
                  "GlobalGameSettingsPage.directories.deleteDialog.content",
                  {
                    dirName: getGameDirName(directory.name),
                  }
                ),
                btnOK: t("General.delete"),
                onOKCallback: () => {
                  handleDeleteDir(directory);
                },
                showSuppressBtn: true,
                suppressKey: "deleteGameDir",
                isAlert: true,
              });
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
              title: getGameDirName(directory),
              description: (
                <VStack spacing={0} align="start" fontSize="xs">
                  <Text className="secondary-text">{directory.dir}</Text>
                  {!isSpecialGameDir(directory.name) &&
                    directoryExistence[directory.dir] === false && (
                      <Text color="red.600">
                        {t(
                          "GlobalGameSettingsPage.directories.directoryNotExist"
                        )}
                      </Text>
                    )}
                </VStack>
              ),
              prefixElement: (
                <Icon
                  as={
                    isSpecialGameDir(directory.name) ||
                    directoryExistence[directory.dir]
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
                      disabled={item.disabled || false}
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
      {/* Game config option-items */}
      <GameSettingsGroups
        gameConfig={globalGameConfigs}
        updateGameConfig={(key: string, value: any) => {
          update(`globalGameConfig.${key}`, value);
        }}
      />
    </>
  );
};

export default GlobalGameSettingsPage;

import {
  HStack,
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { LuArrowRight, LuCloudDownload, LuFolderPlus } from "react-icons/lu";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { CreateInstanceModal } from "@/components/modals/create-instance-modal";
import { DownloadGameServerModal } from "@/components/modals/download-game-server-modal";
import DownloadModpackModal from "@/components/modals/download-modpack-modal";
import { useSharedModals } from "@/contexts/shared-modal";

const AddAndImportInstancePage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { openSharedModal } = useSharedModals();

  const {
    isOpen: isCreateInstanceModalOpen,
    onOpen: onOpenCreateInstanceModal,
    onClose: onCloseCreateInstanceModal,
  } = useDisclosure();
  const {
    isOpen: isModpackMenuOpen,
    onOpen: onOpenModpackMenu,
    onClose: onCloseModpackMenu,
  } = useDisclosure();
  const {
    isOpen: isDownloadModpackModalOpen,
    onOpen: onOpenDownloadModpackModal,
    onClose: onCloseDownloadModpackModal,
  } = useDisclosure();
  const {
    isOpen: isDownloadGameServerModalOpen,
    onOpen: onOpenDownloadGameServerModal,
    onClose: onCloseDownloadGameServerModal,
  } = useDisclosure();

  const handleImportModpackFromDisk = async () => {
    let filePath = await open({
      multiple: false,
      filters: [
        {
          name: t("General.dialog.filterName.modpack"),
          extensions: ["zip", "mrpack"],
        },
      ],
    });
    if (filePath) {
      openSharedModal("import-modpack", {
        path: filePath,
      });
    }
  };

  const addAndImportOptions: Record<string, () => void> = {
    new: onOpenCreateInstanceModal,
    modpack: onOpenModpackMenu,
    manageDirs: () => router.push("/settings/global-game"),
  };

  const moreOptions: Record<string, () => void> = {
    server: onOpenDownloadGameServerModal,
  };

  const modpackOperations = [
    {
      icon: LuFolderPlus,
      label: t("AddAndImportInstancePage.modpackOperations.fromdisk"),
      onClick: () => {
        handleImportModpackFromDisk();
      },
    },
    {
      icon: LuCloudDownload,
      label: t("AddAndImportInstancePage.modpackOperations.download"),
      onClick: () => {
        onOpenDownloadModpackModal();
      },
    },
  ];

  const ModpackMenu = () => {
    return (
      <Menu isOpen={isModpackMenuOpen} onClose={onCloseModpackMenu}>
        <MenuButton>
          <Icon as={LuArrowRight} boxSize={3.5} mr="5px" />
        </MenuButton>
        <Portal>
          <MenuList>
            {modpackOperations.map((item) => (
              <MenuItem key={item.label} fontSize="xs" onClick={item.onClick}>
                <HStack>
                  <item.icon />
                  <Text>{item.label}</Text>
                </HStack>
              </MenuItem>
            ))}
          </MenuList>
        </Portal>
      </Menu>
    );
  };

  const optionGroups: OptionItemGroupProps[] = [
    {
      title: t("AllInstancesPage.button.addAndImport"),
      items: Object.keys(addAndImportOptions).map((key) => ({
        title: t(`AddAndImportInstancePage.addAndImportOptions.${key}.title`),
        description: t(
          `AddAndImportInstancePage.addAndImportOptions.${key}.description`
        ),
        children:
          key === "modpack" ? (
            <ModpackMenu />
          ) : (
            <Icon as={LuArrowRight} boxSize={3.5} mr="5px" />
          ),
        isFullClickZone: true,
        onClick: addAndImportOptions[key],
      })),
    },
    {
      title: t("AddAndImportInstancePage.moreOptions.title"),
      items: Object.keys(moreOptions).map((key) => ({
        title: t(`AddAndImportInstancePage.moreOptions.${key}.title`),
        description: t(
          `AddAndImportInstancePage.moreOptions.${key}.description`
        ),
        children: <Icon as={LuArrowRight} boxSize={3.5} mr="5px" />,
        isFullClickZone: true,
        onClick: moreOptions[key],
      })),
    },
  ];

  return (
    <>
      <VStack w="100%" spacing={4}>
        {optionGroups.map((group, index) => (
          <OptionItemGroup w="100%" {...group} key={index} />
        ))}
      </VStack>
      <CreateInstanceModal
        isOpen={isCreateInstanceModalOpen}
        onClose={onCloseCreateInstanceModal}
      />
      <DownloadModpackModal
        isOpen={isDownloadModpackModalOpen}
        onClose={onCloseDownloadModpackModal}
      />
      <DownloadGameServerModal
        isOpen={isDownloadGameServerModalOpen}
        onClose={onCloseDownloadGameServerModal}
      />
    </>
  );
};

export default AddAndImportInstancePage;

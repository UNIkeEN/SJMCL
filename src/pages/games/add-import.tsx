import {
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
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

const AddAndImportInstancePage = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    isOpen: isCreateInstanceModalOpen,
    onOpen: onOpenCreateInstanceModal,
    onClose: onCloseCreateInstanceModal,
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

  const addAndImportOptions: Record<string, () => void> = {
    new: onOpenCreateInstanceModal,
    modpack: () => {},
    manageDirs: () => router.push("/settings/global-game"),
  };

  const moreOptions: Record<string, () => void> = {
    server: onOpenDownloadGameServerModal,
  };

  const modpackOperations = [
    {
      icon: LuFolderPlus,
      label: t("AddAndImportInstancePage.modpackOperations.fromdisk"),
      onClick: () => {},
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
      <Menu>
        <MenuButton
          as={IconButton}
          size="sm"
          variant="ghost"
          aria-label="operations"
          icon={<LuArrowRight />}
        />
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
      title: t("AllGamesPage.button.addAndImport"),
      items: Object.keys(addAndImportOptions).map((key) => ({
        title: t(`AddAndImportInstancePage.addAndImportOptions.${key}.title`),
        description: t(
          `AddAndImportInstancePage.addAndImportOptions.${key}.description`
        ),
        children:
          key === "modpack" ? (
            <ModpackMenu />
          ) : (
            <IconButton
              aria-label={key}
              onClick={addAndImportOptions[key]}
              variant="ghost"
              size="sm"
              icon={<LuArrowRight />}
            />
          ),
      })),
    },
    {
      title: t("AddAndImportInstancePage.moreOptions.title"),
      items: Object.keys(moreOptions).map((key) => ({
        title: t(`AddAndImportInstancePage.moreOptions.${key}.title`),
        description: t(
          `AddAndImportInstancePage.moreOptions.${key}.description`
        ),
        children: (
          <IconButton
            aria-label={key}
            onClick={moreOptions[key]}
            variant="ghost"
            size="sm"
            icon={<LuArrowRight />}
          />
        ),
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

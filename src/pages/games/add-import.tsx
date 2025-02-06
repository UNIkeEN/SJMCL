import { IconButton, VStack, useDisclosure } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { LuArrowRight } from "react-icons/lu";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { CreateInstanceModal } from "@/components/modals/create-instance-modal";
import { DownloadGameServerModal } from "@/components/modals/download-game-server-modal";

const AddAndImportInstancePage = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    isOpen: isCreateInstanceModalOpen,
    onOpen: onOpenCreateInstanceModal,
    onClose: onCloseCreateInstanceModal,
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

  const optionGroups: OptionItemGroupProps[] = [
    {
      title: t("AllGamesPage.button.addAndImport"),
      items: Object.keys(addAndImportOptions).map((key) => ({
        title: t(`AddAndImportInstancePage.addAndImportOptions.${key}.title`),
        description: t(
          `AddAndImportInstancePage.addAndImportOptions.${key}.description`
        ),
        children: (
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
      {optionGroups.map((group, index) => (
        <OptionItemGroup {...group} key={index} />
      ))}
      <CreateInstanceModal
        isOpen={isCreateInstanceModalOpen}
        onClose={onCloseCreateInstanceModal}
      />
      <DownloadGameServerModal
        isOpen={isDownloadGameServerModalOpen}
        onClose={onCloseDownloadGameServerModal}
      />
    </>
  );
};

export default AddAndImportInstancePage;

import { IconButton, useDisclosure } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuArrowRight } from "react-icons/lu";
import { OptionItemGroup } from "@/components/common/option-item";
import { DownloadGameServerModal } from "@/components/modals/download-game-server-modal";

const MorePage = () => {
  const { t } = useTranslation();
  const {
    isOpen: isDownloadGameServerModalOpen,
    onOpen: onOpenDownloadGameServerModal,
    onClose: onCloseDownloadGameServerModal,
  } = useDisclosure();
  const moreOptions: Record<string, () => void> = {
    server: onOpenDownloadGameServerModal,
  };

  return (
    <>
      <OptionItemGroup
        title={t("morePage.button.more")}
        items={Object.keys(moreOptions).map((key) => ({
          title: t(`morePage.moreOptions.${key}.title`),
          description: t(`morePage.moreOptions.${key}.description`),
          children: (
            <IconButton
              aria-label={key}
              onClick={moreOptions[key]}
              variant="ghost"
              size="sm"
              icon={<LuArrowRight />}
            />
          ),
        }))}
      />
      <DownloadGameServerModal
        isOpen={isDownloadGameServerModalOpen}
        onClose={onCloseDownloadGameServerModal}
      />
    </>
  );
};

export default MorePage;

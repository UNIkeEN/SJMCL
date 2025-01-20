import { Button, HStack, useDisclosure } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import GenericConfirmDialog from "@/components/modals/generic-confirm-dialog";
import {
  SyncConfigExportModal,
  SyncConfigImportModal,
} from "@/components/modals/sync-config-modals";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";

const SyncAndRestoreSettingsPage = () => {
  const { t } = useTranslation();
  const { restoreAll } = useLauncherConfig();

  const {
    isOpen: isRestoreConfirmDialogOpen,
    onOpen: onRestoreConfirmDialogOpen,
    onClose: onRestoreConfirmDialogClose,
  } = useDisclosure();

  const {
    isOpen: isSyncConfigExportModalOpen,
    onOpen: onSyncConfigExportModalOpen,
    onClose: onSyncConfigExportModalClose,
  } = useDisclosure();

  const {
    isOpen: isSyncConfigImportModalOpen,
    onOpen: onSyncConfigImportModalOpen,
    onClose: onSyncConfigImportModalClose,
  } = useDisclosure();

  const syncAndRestoreSettingGroups: OptionItemGroupProps[] = [
    {
      title: t("SyncAndRestoreSettingsPage.launcherConfig.title"),
      items: [
        {
          title: t(
            "SyncAndRestoreSettingsPage.launcherConfig.settings.internetSync.title"
          ),
          children: (
            <HStack>
              <Button
                variant="subtle"
                size="xs"
                onClick={onSyncConfigExportModalOpen}
              >
                {t(
                  "SyncAndRestoreSettingsPage.launcherConfig.settings.internetSync.export"
                )}
              </Button>
              <Button
                variant="subtle"
                size="xs"
                onClick={onSyncConfigImportModalOpen}
              >
                {t(
                  "SyncAndRestoreSettingsPage.launcherConfig.settings.internetSync.import"
                )}
              </Button>
            </HStack>
          ),
        },
        {
          title: t(
            "SyncAndRestoreSettingsPage.launcherConfig.settings.restoreAll.title"
          ),
          description: t(
            "SyncAndRestoreSettingsPage.launcherConfig.settings.restoreAll.description"
          ),
          children: (
            <Button
              colorScheme="red"
              variant="subtle"
              size="xs"
              onClick={onRestoreConfirmDialogOpen}
            >
              {t(
                "SyncAndRestoreSettingsPage.launcherConfig.settings.restoreAll.restore"
              )}
            </Button>
          ),
        },
      ],
    },
  ];

  return (
    <>
      {syncAndRestoreSettingGroups.map((group, index) => (
        <OptionItemGroup title={group.title} items={group.items} key={index} />
      ))}

      <SyncConfigExportModal
        isOpen={isSyncConfigExportModalOpen}
        onClose={onSyncConfigExportModalClose}
      />
      <SyncConfigImportModal
        isOpen={isSyncConfigImportModalOpen}
        onClose={onSyncConfigImportModalClose}
      />
      <GenericConfirmDialog
        isOpen={isRestoreConfirmDialogOpen}
        onClose={onRestoreConfirmDialogClose}
        title={t("RestoreConfigConfirmDialog.title")}
        body={t("RestoreConfigConfirmDialog.body")}
        btnOK={t("General.confirm")}
        btnCancel={t("General.cancel")}
        onOKCallback={() => {
          restoreAll();
          onRestoreConfirmDialogClose();
        }}
        isAlert
      />
    </>
  );
};

export default SyncAndRestoreSettingsPage;

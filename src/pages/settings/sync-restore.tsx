import { Button, HStack, useDisclosure } from "@chakra-ui/react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import {
  SyncConfigExportModal,
  SyncConfigImportModal,
} from "@/components/modals/sync-config-modals";
import { useLauncherConfig } from "@/contexts/config";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { ConfigService } from "@/services/config";

const SyncAndRestoreSettingsPage = () => {
  const { t } = useTranslation();
  const { setConfig } = useLauncherConfig();
  const toast = useToast();
  const { openGenericConfirmDialog, closeSharedModal } = useSharedModals();

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

  const handleRestoreLauncherConfig = useCallback(async () => {
    ConfigService.restoreLauncherConfig().then((response) => {
      if (response.status === "success") {
        setConfig(response.data);
        toast({
          title: response.message,
          status: "success",
        });
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
    closeSharedModal("generic-confirm");
  }, [setConfig, toast, closeSharedModal]);

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
              onClick={() => {
                openGenericConfirmDialog({
                  title: t("RestoreConfigConfirmDialog.title"),
                  body: t("RestoreConfigConfirmDialog.body"),
                  isAlert: true,
                  onOKCallback: handleRestoreLauncherConfig,
                });
              }}
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
    </>
  );
};

export default SyncAndRestoreSettingsPage;

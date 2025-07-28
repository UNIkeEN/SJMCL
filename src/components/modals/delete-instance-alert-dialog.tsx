import { AlertDialogProps, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import GenericConfirmDialog from "@/components/modals/generic-confirm-dialog";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useToast } from "@/contexts/toast";
import { InstanceSummary } from "@/models/instance/misc";
import { InstanceService } from "@/services/instance";

interface DeleteInstanceDialogProps extends Omit<AlertDialogProps, "children"> {
  instance: InstanceSummary;
}

// Make it a separate component for use with the shared-modal-provider (and context).
const DeleteInstanceDialog: React.FC<DeleteInstanceDialogProps> = ({
  instance,
  ...dialogProps
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const { getInstanceList } = useGlobalData();
  const { config } = useLauncherConfig();

  const handleDeleteInstance = (instanceId: string) => {
    InstanceService.deleteInstance(instanceId).then((response) => {
      if (response.status === "success") {
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

    // Navigate to /instances/list
    if (!router.asPath.startsWith("/instances/list")) {
      router.push("/instances/list");
    }
    getInstanceList(true);
  };

  if (config.suppressedDialogs?.includes("deleteInstanceAlert")) {
    if (dialogProps.isOpen) {
      handleDeleteInstance(instance.id);
      dialogProps.onClose();
    }
    return null;
  }

  return (
    <GenericConfirmDialog
      isOpen={dialogProps.isOpen}
      onClose={dialogProps.onClose}
      title={t("DeleteInstanceAlertDialog.dialog.title")}
      body={
        <VStack align="stretch">
          <Text>
            {t("DeleteInstanceAlertDialog.dialog.content", {
              instanceName: instance.name,
            })}
          </Text>
          <Text>
            {t(
              `DeleteInstanceAlertDialog.dialog.warning.${instance.isVersionIsolated ? "withVerIso" : "woVerIso"}`
            )}
          </Text>
        </VStack>
      }
      btnOK={t("General.delete")}
      onOKCallback={() => {
        handleDeleteInstance(instance.id);
        dialogProps.onClose();
      }}
      isAlert
      showSuppressBtn
      suppressKey="deleteInstanceAlert"
    />
  );
};

export default DeleteInstanceDialog;

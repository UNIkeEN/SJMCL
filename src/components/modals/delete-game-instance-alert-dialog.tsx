import { AlertDialogProps, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import GenericConfirmDialog from "@/components/modals/generic-confirm-dialog";
import { useData } from "@/contexts/data";
import { useToast } from "@/contexts/toast";
import { GameInstanceSummary } from "@/models/instance/misc";
import { InstanceService } from "@/services/instance";

interface DeleteGameInstanceDialogProps
  extends Omit<AlertDialogProps, "children"> {
  game: GameInstanceSummary;
}

// Make it a separate component for use with the shared-modal-provider (and context).
const DeleteGameInstanceDialog: React.FC<DeleteGameInstanceDialogProps> = ({
  game,
  ...dialogProps
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const { getGameInstanceList } = useData();

  const handleDeleteInstance = (instanceId: number) => {
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

    // Navigate to /games/all
    getGameInstanceList(true);
    router.push("/games/all");
  };

  return (
    <GenericConfirmDialog
      isOpen={dialogProps.isOpen}
      onClose={dialogProps.onClose}
      title={t("DeleteGameInstanceAlertDialog.dialog.title")}
      body={
        <VStack align="stretch">
          <Text>
            {t("DeleteGameInstanceAlertDialog.dialog.content", {
              gameName: game.name,
            })}
          </Text>
          <Text>
            {t(
              `DeleteGameInstanceAlertDialog.dialog.warning.${game.isVersionIsolated ? "withVerIso" : "woVerIso"}`
            )}
          </Text>
        </VStack>
      }
      btnOK={t("General.delete")}
      btnCancel={t("General.cancel")}
      onOKCallback={() => {
        handleDeleteInstance(game.id);
        dialogProps.onClose();
      }}
      isAlert
    />
  );
};

export default DeleteGameInstanceDialog;

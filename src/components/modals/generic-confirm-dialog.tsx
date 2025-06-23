import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Checkbox,
  HStack,
} from "@chakra-ui/react";
import { t } from "i18next";
import { useRef, useState } from "react";
import { useLauncherConfig } from "@/contexts/config";

interface GenericConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  body: string | React.ReactElement;
  btnOK?: string;
  btnCancel?: string;
  onOKCallback?: () => void;
  isAlert?: boolean;
  isLoading?: boolean;
  showSuppressBtn?: boolean;
  suppressKey?: string;
}

const GenericConfirmDialog: React.FC<GenericConfirmDialogProps> = ({
  isOpen,
  onClose,
  title,
  body,
  btnOK = t("General.confirm"),
  btnCancel = t("General.cancel"),
  onOKCallback,
  isAlert = false,
  isLoading = false,
  showSuppressBtn = false,
  suppressKey,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleClose = () => {
    if (dontAskAgain && suppressKey) {
      const current = config.suppressedDialogs ?? [];
      if (!current.includes(suppressKey)) {
        update("suppressedDialogs", [...current, suppressKey]);
      }
    }
    onClose();
  };

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={handleClose}
      autoFocus={false}
      isCentered
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>{title}</AlertDialogHeader>
          <AlertDialogCloseButton />
          <AlertDialogBody>{body}</AlertDialogBody>
          <AlertDialogFooter>
            {showSuppressBtn && suppressKey && (
              <Checkbox
                isChecked={dontAskAgain}
                onChange={(e) => setDontAskAgain(e.target.checked)}
              >
                {t("General.dontAskAgain")}
              </Checkbox>
            )}

            <HStack spacing={3} ml="auto">
              {btnCancel && (
                <Button ref={cancelRef} onClick={handleClose} variant="ghost">
                  {btnCancel}
                </Button>
              )}
              <Button
                colorScheme={isAlert ? "red" : primaryColor}
                onClick={() => {
                  onOKCallback?.();
                  handleClose();
                }}
                isLoading={isLoading}
              >
                {btnOK}
              </Button>
            </HStack>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

export default GenericConfirmDialog;

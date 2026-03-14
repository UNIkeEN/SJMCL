import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogProps,
  Button,
  Checkbox,
  HStack,
  Text,
} from "@chakra-ui/react";
import { t } from "i18next";
import { useRef, useState } from "react";
import { useLauncherConfig } from "@/contexts/config";

interface GenericConfirmDialogProps extends Omit<
  AlertDialogProps,
  "children" | "leastDestructiveRef"
> {
  title: string;
  body: string | React.ReactElement;
  footerLeft?: React.ReactElement;
  btnOK?: string;
  btnCancel?: string;
  onOKCallback?: () => void;
  onCancelCallback?: () => void;
  isAlert?: boolean;
  isLoading?: boolean;
  showCloseBtn?: boolean;
  showSuppressBtn?: boolean;
  suppressKey?: string;
}

const GenericConfirmDialog: React.FC<GenericConfirmDialogProps> = ({
  isOpen,
  onClose,
  title,
  body,
  footerLeft,
  btnOK = t("General.confirm"),
  btnCancel = t("General.cancel"),
  onOKCallback,
  onCancelCallback,
  isAlert = false,
  isLoading = false,
  showCloseBtn = true,
  showSuppressBtn = false,
  suppressKey,
  ...props
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleOK = () => {
    if (dontShowAgain && suppressKey) {
      const current = config.suppressedDialogs ?? [];
      if (!current.includes(suppressKey)) {
        update("suppressedDialogs", [...current, suppressKey]);
      }
    }
    onOKCallback?.();
    onClose();
  };

  const handleCancel = () => {
    onCancelCallback?.();
    onClose();
  };

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={handleCancel}
      autoFocus={false}
      isCentered
      {...props}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>{title}</AlertDialogHeader>
          {showCloseBtn && <AlertDialogCloseButton />}
          <AlertDialogBody>{body}</AlertDialogBody>
          <AlertDialogFooter>
            <HStack spacing={3}>
              {showSuppressBtn && suppressKey && (
                <Checkbox
                  colorScheme={primaryColor}
                  isChecked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                >
                  <Text fontSize="sm">{t("General.dontShowAgain")}</Text>
                </Checkbox>
              )}
              {footerLeft}
            </HStack>

            <HStack spacing={3} ml="auto">
              {btnCancel && (
                <Button ref={cancelRef} onClick={handleCancel} variant="ghost">
                  {btnCancel}
                </Button>
              )}
              <Button
                colorScheme={isAlert ? "red" : primaryColor}
                onClick={handleOK}
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

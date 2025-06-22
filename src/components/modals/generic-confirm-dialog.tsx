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
  Flex,
  HStack,
  Text,
} from "@chakra-ui/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";

interface GenericConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  body: string | React.ReactElement;
  btnOK: string;
  btnCancel: string;
  onOKCallback?: () => void;
  isAlert?: boolean;
  showDontAskAgain?: boolean;
  keyForSuppress?: string;
}

const GenericConfirmDialog: React.FC<GenericConfirmDialogProps> = ({
  isOpen,
  onClose,
  title,
  body,
  btnOK,
  btnCancel,
  onOKCallback,
  isAlert = false,
  showDontAskAgain = false,
  keyForSuppress,
}) => {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleClose = () => {
    if (dontAskAgain && keyForSuppress) {
      const current = config.confirmSuppress ?? [];
      if (!current.includes(keyForSuppress)) {
        update("confirmSuppress", [...current, keyForSuppress]);
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
            <Flex flex="1" align="center">
              {showDontAskAgain && (
                <HStack>
                  <Checkbox
                    isChecked={dontAskAgain}
                    onChange={(e) => setDontAskAgain(e.target.checked)}
                  />
                  <Text>{t("General.dontAskAgain")}</Text>
                </HStack>
              )}
            </Flex>

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
            >
              {btnOK}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

export default GenericConfirmDialog;

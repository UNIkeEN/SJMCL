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
} from "@chakra-ui/react";
import { useRef, useState } from "react";
import { useLauncherConfig } from "@/contexts/config";

interface GenericConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  body: string | React.ReactElement;
  btnOK: string;
  btnCancel: string;
  btnSuppress: string;
  onOKCallback?: () => void;
  isAlert?: boolean;
  showSuppressBtn?: boolean;
  suppressKey?: string;
}

const GenericConfirmDialog: React.FC<GenericConfirmDialogProps> = ({
  isOpen,
  onClose,
  title,
  body,
  btnOK,
  btnCancel,
  btnSuppress,
  onOKCallback,
  isAlert = false,
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
            <Flex flex="1" align="center">
              {showSuppressBtn && (
                <HStack>
                  <Checkbox
                    isChecked={dontAskAgain}
                    onChange={(e) => setDontAskAgain(e.target.checked)}
                  />
                  <text>{btnCancel}</text>
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

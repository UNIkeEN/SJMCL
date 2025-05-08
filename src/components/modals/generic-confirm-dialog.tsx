import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from "@chakra-ui/react";
import { useRef } from "react";
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
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
      autoFocus={false}
      isCentered
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>{title}</AlertDialogHeader>
          <AlertDialogCloseButton />
          <AlertDialogBody>{body}</AlertDialogBody>
          <AlertDialogFooter>
            {btnCancel && (
              <Button ref={cancelRef} onClick={onClose} variant="ghost">
                {btnCancel}
              </Button>
            )}
            <Button
              colorScheme={isAlert ? "red" : primaryColor}
              onClick={onOKCallback}
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

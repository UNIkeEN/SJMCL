import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  HStack,
} from "@chakra-ui/react";
import { exit } from "@tauri-apps/plugin-process";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { LuLanguages } from "react-icons/lu";
import LanguageMenu from "@/components/language-menu";

interface UnavailableExePathAlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const UnavailableExePathAlertDialog: React.FC<
  UnavailableExePathAlertDialogProps
> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog
      isOpen={isOpen}
      onClose={onClose}
      leastDestructiveRef={cancelRef}
      autoFocus={false}
      closeOnEsc={false}
      closeOnOverlayClick={false}
      isCentered
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>
            {t("UnavailableExePathAlertDialog.dialog.title")}
          </AlertDialogHeader>
          <AlertDialogBody>
            {t("UnavailableExePathAlertDialog.dialog.content")}
          </AlertDialogBody>
          <AlertDialogFooter w="100%">
            <HStack spacing={2}>
              <LuLanguages />
              <LanguageMenu placement="top" />
            </HStack>
            <Button ml="auto" colorScheme="red" onClick={() => exit(0)}>
              {t("General.exit")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

export default UnavailableExePathAlertDialog;

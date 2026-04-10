import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  ModalProps,
  Text,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import { MacosModalHeader } from "@/components/common/macos-modal-header";
import { WindowsCloseButton } from "@/components/common/windows-close-button";

const StarUsModal: React.FC<Omit<ModalProps, "children">> = ({ ...props }) => {
  const { t } = useTranslation();

  const handleStar = () => {
    openUrl("https://github.com/UNIkeEN/SJMCL");
    props.onClose();
  };

  return (
    <Modal autoFocus={false} size={{ base: "sm", lg: "md" }} {...props}>
      <ModalOverlay />
      <ModalContent borderRadius="md" overflow="hidden">
        <video autoPlay loop muted width="100%" height="auto">
          <source src="/videos/star-3-2.mp4" type="video/mp4" />
        </video>
        <MacosModalHeader>
          🌟&nbsp;&nbsp;{t("StarUsModal.header.title")}
        </MacosModalHeader>
        <WindowsCloseButton onClick={props.onClose} />
        <ModalBody mt={-1}>
          <Text color="gray.500">{t("StarUsModal.body")}</Text>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={props.onClose}>
            {t("StarUsModal.button.later")}
          </Button>
          <Button colorScheme="orange" onClick={handleStar}>
            {t("StarUsModal.button.starUs")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default StarUsModal;

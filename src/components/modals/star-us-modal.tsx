import {
  Box,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Text,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import { useTranslation } from "react-i18next";

const StarUsModal: React.FC<Omit<ModalProps, "children">> = ({ ...props }) => {
  const { t } = useTranslation();

  const handleStar = () => {
    open("https://github.com/UNIkeEN/SJMCL");
    props.onClose();
  };

  return (
    <Modal size={{ base: "sm", lg: "md" }} {...props}>
      <ModalOverlay />
      <ModalContent borderRadius="md" overflow="hidden">
        <video autoPlay loop muted width="100%" height="auto">
          <source src="/videos/star-3-2.mp4" type="video/mp4" />
        </video>
        <ModalHeader>{t("StarUsModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody mt={-2}>
          <Text color="gray.500" fontSize="xs-sm">
            {t("StarUsModal.body")}
          </Text>
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

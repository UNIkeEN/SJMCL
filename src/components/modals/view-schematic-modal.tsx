import {
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

interface ViewSchematicModalProps extends Omit<ModalProps, "children"> {
  fileUrl?: string;
}

const ViewSchematicModal: React.FC<ViewSchematicModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  ...modalProps
}) => {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("ViewSchematicModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={4}>
          <Flex justify="center" align="center" width="100%" height="100%">
            {/* TODO */}
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default ViewSchematicModal;

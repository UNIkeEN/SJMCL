import {
  Flex,
  Modal,
  ModalBody,
  ModalContent,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { MacosCloseButton } from "@/components/common/macos-close-button";
import { MacosModalHeader } from "@/components/common/macos-modal-header";

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
        <MacosModalHeader>
          {t("ViewSchematicModal.header.title")}
        </MacosModalHeader>
        <MacosCloseButton onClick={onClose} />
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

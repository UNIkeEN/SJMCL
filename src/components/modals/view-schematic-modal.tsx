import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import SchematicView from "@/components/schematic-view";

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
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("ViewSchematicModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6} display="flex" flexDirection="column" flex="1">
          <SchematicView fileUrl={fileUrl} />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default ViewSchematicModal;

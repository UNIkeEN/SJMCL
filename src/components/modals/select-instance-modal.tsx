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
import InstancesView from "@/components/instances-view";
import { InstanceSummary } from "@/models/instance/misc";

interface SelectInstanceModalProps extends Omit<ModalProps, "children"> {
  candidateInstances: InstanceSummary[];
  selectedInstance?: InstanceSummary;
  onInstanceSelected: (instance: InstanceSummary) => void;
  modalTitle?: string;
}

const SelectInstanceModal: React.FC<SelectInstanceModalProps> = ({
  candidateInstances,
  selectedInstance,
  onInstanceSelected,
  modalTitle,
  ...modalProps
}) => {
  const { t } = useTranslation();

  return (
    <Modal size="md" {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {modalTitle || t("SelectInstanceModal.header.title")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <InstancesView
            instances={candidateInstances}
            selectedInstance={selectedInstance}
            viewType="list"
            withMenu={false}
            onSelectInstance={onInstanceSelected}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SelectInstanceModal;

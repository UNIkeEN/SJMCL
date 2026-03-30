import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
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
    <Modal scrollBehavior="inside" {...modalProps}>
      <ModalOverlay />
      <ModalContent maxH="calc(100vh - 7.5rem)">
        <ModalHeader>
          {modalTitle || t("SelectInstanceModal.header.title")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody display="flex" flexDir="column" flex="1">
          <InstancesView
            instances={candidateInstances}
            selectedInstance={selectedInstance}
            viewType="list"
            withMenu={false}
            onSelectInstance={onInstanceSelected}
            onWheel={(e) => {
              e.stopPropagation();
            }}
          />
        </ModalBody>
        <ModalFooter />
      </ModalContent>
    </Modal>
  );
};

export default SelectInstanceModal;

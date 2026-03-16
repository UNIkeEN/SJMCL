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
    <Modal size="md" scrollBehavior="inside" {...modalProps}>
      <ModalOverlay />
      <ModalContent maxH="80vh" pb={4}>
        <ModalHeader>
          {modalTitle || t("SelectInstanceModal.header.title")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6} minH={0}>
          <InstancesView
            h="100%"
            overflowY="auto"
            overflowX="hidden"
            onWheel={(e) => {
              e.stopPropagation();
            }}
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

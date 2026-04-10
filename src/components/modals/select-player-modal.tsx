import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { WindowsCloseButton } from "@/components/common/windows-close-button";
import PlayersView from "@/components/players-view";
import { Player } from "@/models/account";

interface SelectPlayerModalProps extends Omit<ModalProps, "children"> {
  candidatePlayers: Player[];
  onPlayerSelected: (player: Player) => void;
  modalTitle?: string;
  showDesc?: boolean;
}

const SelectPlayerModal: React.FC<SelectPlayerModalProps> = ({
  candidatePlayers,
  onPlayerSelected,
  modalTitle,
  showDesc = true,
  ...modalProps
}) => {
  const { t } = useTranslation();

  return (
    <Modal scrollBehavior="inside" {...modalProps}>
      <ModalOverlay />
      <ModalContent maxH="calc(100vh - 7.5rem)">
        <ModalHeader>
          {modalTitle || t("SelectPlayerModal.header.title")}
        </ModalHeader>
        <WindowsCloseButton onClick={modalProps.onClose} />
        <ModalBody display="flex" flexDir="column" flex="1" minH={0}>
          <PlayersView
            players={candidatePlayers}
            selectedPlayer={undefined}
            viewType="list"
            withMenu={false}
            showDesc={showDesc}
            onSelectPlayer={onPlayerSelected}
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

export default SelectPlayerModal;

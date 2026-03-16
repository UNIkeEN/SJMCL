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
    <Modal size="md" scrollBehavior="inside" {...modalProps}>
      <ModalOverlay />
      <ModalContent maxH="80vh" pb={4}>
        <ModalHeader>
          {modalTitle || t("SelectPlayerModal.header.title")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6} minH={0}>
          <PlayersView
            h="100%"
            maxH="60vh"
            overflowY="auto"
            overflowX="hidden"
            onWheel={(e) => {
              e.stopPropagation();
            }}
            players={candidatePlayers}
            selectedPlayer={undefined}
            viewType="list"
            withMenu={false}
            showDesc={showDesc}
            onSelectPlayer={onPlayerSelected}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SelectPlayerModal;

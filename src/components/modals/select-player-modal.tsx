import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { OptionItem } from "@/components/common/option-item";
import PlayerAvatar from "@/components/player-avatar";
import { Player } from "@/models/account";

interface SelectPlayerModalProps extends Omit<ModalProps, "children"> {
  candidatePlayers: Player[];
  onPlayerSelected: (player: Player) => void;
}

const SelectPlayerModal: React.FC<SelectPlayerModalProps> = ({
  candidatePlayers,
  onPlayerSelected,
  ...modalProps
}) => {
  const { t } = useTranslation();

  return (
    <Modal size="md" {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("SelectPlayerModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={4}>
          <VStack spacing={0} alignItems="stretch">
            {candidatePlayers.map((player) => (
              <OptionItem
                key={player.id}
                title={
                  <Text fontWeight="semibold" fontSize="sm">
                    {player.name}
                  </Text>
                }
                w="full"
                prefixElement={
                  <PlayerAvatar
                    avatar={player.avatar}
                    boxSize="32px"
                    objectFit="cover"
                    m={2}
                  />
                }
                onClick={() => onPlayerSelected(player)}
                isFullClickZone
              />
            ))}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SelectPlayerModal;

import {
  Image,
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
import { Player } from "@/models/account";
import { base64ImgSrc } from "@/utils/string";

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
          <VStack spacing={2} alignItems="start" w="full">
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
                  <Image
                    boxSize="32px"
                    objectFit="cover"
                    src={base64ImgSrc(player.avatar)}
                    alt={player.name}
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

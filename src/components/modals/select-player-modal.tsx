import {
  HStack,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Radio,
  VStack,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { OptionItem } from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
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
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  return (
    <Modal size="md" {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("SelectPlayerModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={4}>
          <VStack spacing={4} alignItems="start">
            {candidatePlayers.map((player) => (
              <OptionItem
                key={player.id}
                title={player.name}
                prefixElement={
                  <HStack spacing={2.5}>
                    <Radio
                      value={player.id}
                      onClick={() => onPlayerSelected(player)}
                      colorScheme={primaryColor}
                    />
                    <Image
                      boxSize="32px"
                      objectFit="cover"
                      src={base64ImgSrc(player.avatar)}
                      alt={player.name}
                    />
                  </HStack>
                }
              />
            ))}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SelectPlayerModal;

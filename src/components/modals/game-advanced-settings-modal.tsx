import {
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import GameAdvancedSettingsGroups from "@/components/game-advanced-settings-group";

export const GameAdvancedSettingsModal: React.FC<
  Omit<ModalProps, "children"> & { instanceId?: number }
> = ({ instanceId, ...modalProps }) => {
  const { t } = useTranslation();

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent minH="80vh" maxH="90vh" h="auto">
        <ModalHeader>
          <HStack w="100%" justify="flex-start" align="center">
            <Text>{t("GameAdvancedSettingsModal.header.title")}</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <Flex direction="column" h="full">
          <ModalBody overflowY="auto" flex="1" maxH="calc(100vh - 150px)">
            <GameAdvancedSettingsGroups instanceId={instanceId} />
          </ModalBody>
        </Flex>
      </ModalContent>
    </Modal>
  );
};

export default GameAdvancedSettingsModal;

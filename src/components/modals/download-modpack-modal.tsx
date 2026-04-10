import {
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalContent,
  ModalOverlay,
  ModalProps,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { MacosModalHeader } from "@/components/common/macos-modal-header";
import { WindowsCloseButton } from "@/components/common/windows-close-button";
import ResourceDownloader from "@/components/resource-downloader";
import { OtherResourceSource, OtherResourceType } from "@/enums/resource";

interface DownloadModpackModalProps extends Omit<ModalProps, "children"> {
  initialSearchQuery?: string;
  initialDownloadSource?: OtherResourceSource;
}

export const DownloadModpackModal: React.FC<DownloadModpackModalProps> = ({
  initialSearchQuery = "",
  initialDownloadSource = OtherResourceSource.CurseForge,
  ...modalProps
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
        <MacosModalHeader>
          <HStack w="100%" justify="flex-start" align="center">
            <Text>{t("DownloadModpackModal.header.title")}</Text>
          </HStack>
        </MacosModalHeader>
        <WindowsCloseButton onClick={modalProps.onClose} />
        <Flex flexGrow="1" flexDir="column">
          <ModalBody>
            <ResourceDownloader
              resourceType={OtherResourceType.ModPack}
              initialSearchQuery={initialSearchQuery}
              initialDownloadSource={initialDownloadSource}
            />
          </ModalBody>
        </Flex>
      </ModalContent>
    </Modal>
  );
};

export default DownloadModpackModal;

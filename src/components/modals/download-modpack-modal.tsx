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
import ResourceDownloader from "@/components/resource-downloader";
import { OtherResourceType } from "@/enums/resource";

export const DownloadModpackModal: React.FC<Omit<ModalProps, "children">> = ({
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
        <ModalHeader>
          <HStack w="100%" justify="flex-start" align="center">
            <Text>{t("DownloadModpackModal.header.title")}</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <Flex flexGrow="1" flexDir="column">
          <ModalBody>
            <ResourceDownloader resourceType={OtherResourceType.ModPack} />
          </ModalBody>
        </Flex>
      </ModalContent>
    </Modal>
  );
};

export default DownloadModpackModal;

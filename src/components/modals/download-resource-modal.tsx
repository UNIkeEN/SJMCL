import {
  Flex,
  HStack,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import { LuEarth, LuHaze, LuPackage, LuSquareLibrary } from "react-icons/lu";
import NavMenu from "@/components/common/nav-menu";
import ResourceDownloader from "@/components/resource-downloader";

interface DownloadResourceModalProps extends Omit<ModalProps, "children"> {
  initialResourceType?: string;
}

const DownloadResourceModal: React.FC<DownloadResourceModalProps> = ({
  initialResourceType = "mod",
  ...modalProps
}) => {
  const { t } = useTranslation();

  const [selectedResourceType, setSelectedResourceType] =
    useState<string>(initialResourceType);

  const resourceTypeList: { key: string; icon: IconType }[] = [
    { key: "mod", icon: LuSquareLibrary },
    { key: "world", icon: LuEarth },
    { key: "resourcepack", icon: LuPackage },
    { key: "shader", icon: LuHaze },
  ];

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%" pb={4}>
        <ModalHeader>
          <HStack w="100%" justify="flex-start" align="center">
            <Text>{t("DownloadResourceModal.header.title")}</Text>
            <NavMenu
              className="no-scrollbar"
              overflowX="auto"
              selectedKeys={[selectedResourceType]}
              onClick={(value) => setSelectedResourceType(value)}
              direction="row"
              size="xs"
              spacing={3}
              mr={4}
              flex={1}
              display="flex"
              justify="center"
              items={resourceTypeList.map((item) => ({
                value: item.key,
                label: (
                  <HStack spacing={1.5} fontSize="sm">
                    <Icon as={item.icon} />
                    <Text>
                      {t(`DownloadResourceModal.resourceTypeList.${item.key}`)}
                    </Text>
                  </HStack>
                ),
              }))}
            />
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <Flex flexGrow="1" flexDir="column">
          <ModalBody>
            <ResourceDownloader
              // key={selectedResourceType}
              resourceType={selectedResourceType}
            />
          </ModalBody>
        </Flex>
      </ModalContent>
    </Modal>
  );
};

export default DownloadResourceModal;

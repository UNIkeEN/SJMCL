import {
  Avatar,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Tag,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuDownload, LuGlobe, LuUpload } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { OptionItem } from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { useSharedModals } from "@/contexts/shared-modal";
import { ModLoaderType } from "@/enums/instance";
import { OtherResourceSource } from "@/enums/resource";
import { OtherResourceDependency } from "@/models/resource";
import { ResourceService } from "@/services/resource";
import { ISOToDate } from "@/utils/datetime";
import { formatDisplayCount } from "@/utils/string";

interface AlertResourceDependencyModalProps
  extends Omit<ModalProps, "children"> {
  dependencies: OtherResourceDependency[];
  downloadSource: OtherResourceSource;
  curInstanceMajorVersion?: string;
  curInstanceVersion?: string;
  curInstanceModLoader?: ModLoaderType;
  downloadOriginalResource: () => void;
}

const AlertResourceDependencyModal: React.FC<
  AlertResourceDependencyModalProps
> = ({
  dependencies,
  downloadSource,
  curInstanceMajorVersion,
  curInstanceVersion,
  curInstanceModLoader,
  downloadOriginalResource,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { openSharedModal } = useSharedModals();

  const [dependencyList, setDependencyList] = useState<
    OtherResourceDependency[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDependencyResources = useCallback(async () => {
    setIsLoading(true);
    try {
      const promises = dependencies.map((dep) =>
        ResourceService.fetchRemoteResourceById(downloadSource, dep.resourceId)
      );

      const responses = await Promise.all(promises);
      const updatedDependencies: OtherResourceDependency[] = [];

      dependencies.forEach((dep, index) => {
        const response = responses[index];
        if (response.status === "success") {
          updatedDependencies.push({
            ...dep,
            resource: response.data,
          });
        } else {
          updatedDependencies.push(dep);
        }
      });

      setDependencyList(updatedDependencies);
    } finally {
      setIsLoading(false);
    }
  }, [dependencies, downloadSource]);

  useEffect(() => {
    fetchDependencyResources();
  }, [fetchDependencyResources]);

  const renderDependencyItem = (dependency: OtherResourceDependency) => {
    if (!dependency.resource) {
      return (
        <OptionItem
          key={dependency.resourceId}
          title={
            <Text fontSize="xs-sm" className="ellipsis-text">
              {t("AlertResourceDependencyModal.fallback.title", {
                resourceId: dependency.resourceId,
              })}
            </Text>
          }
          titleExtra={
            <Tag size="sm" colorScheme="orange" variant="subtle">
              {t(
                `AlertResourceDependencyModal.dependencyType.${dependency.relation}`
              )}
            </Tag>
          }
          description={
            <Text fontSize="xs" className="secondary-text">
              {t("AlertResourceDependencyModal.fallback.description")}
            </Text>
          }
          prefixElement={
            <Avatar
              name={dependency.resourceId}
              boxSize="42px"
              borderRadius="4px"
            />
          }
          fontWeight={400}
        />
      );
    }

    const resource = dependency.resource;
    return (
      <OptionItem
        key={resource.id}
        title={
          <Text fontSize="xs-sm" className="ellipsis-text">
            {resource.translatedName
              ? `${resource.translatedName} | ${resource.name}`
              : resource.name}
          </Text>
        }
        titleExtra={
          <Tag size="sm" colorScheme="orange" variant="subtle">
            {t(
              `AlertResourceDependencyModal.dependencyType.${dependency.relation}`
            )}
          </Tag>
        }
        description={
          <VStack
            fontSize="xs"
            className="secondary-text"
            spacing={1}
            align="flex-start"
            w="100%"
          >
            <Text overflow="hidden" className="ellipsis-text">
              {resource.description}
            </Text>
            <HStack spacing={6}>
              <HStack spacing={1}>
                <LuUpload />
                <Text>{ISOToDate(resource.lastUpdated)}</Text>
              </HStack>
              <HStack spacing={1}>
                <LuDownload />
                <Text>{formatDisplayCount(resource.downloads)}</Text>
              </HStack>
              {resource.source && (
                <HStack spacing={1}>
                  <LuGlobe />
                  <Text>{resource.source}</Text>
                </HStack>
              )}
            </HStack>
          </VStack>
        }
        prefixElement={
          <Avatar
            src={resource.iconSrc}
            name={resource.name}
            boxSize="42px"
            borderRadius="4px"
          />
        }
        isFullClickZone
        onClick={() => {
          modalProps.onClose();
          openSharedModal("download-specific-resource", {
            resource,
            curInstanceMajorVersion,
            curInstanceVersion,
            curInstanceModLoader,
          });
        }}
        fontWeight={400}
      />
    );
  };

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "md", lg: "lg", xl: "xl" }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
        <ModalHeader>
          {t("AlertResourceDependencyModal.header.title")}
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody
          flex="1"
          display="flex"
          flexDirection="column"
          overflowY="auto"
          onWheel={(e) => {
            e.stopPropagation();
          }}
        >
          {isLoading ? (
            <VStack mt={8}>
              <BeatLoader size={16} color="gray" />
            </VStack>
          ) : (
            <VStack
              spacing={2}
              align="stretch"
              maxH={{ base: "sm", md: "md", lg: "lg" }}
              overflowY="auto"
            >
              <Text className="secondary-text" mb={2}>
                {t("AlertResourceDependencyModal.description")}
              </Text>
              {dependencyList.map((dependency) =>
                renderDependencyItem(dependency)
              )}
            </VStack>
          )}
        </ModalBody>

        <ModalFooter flexShrink={0}>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={modalProps.onClose}>
              {t("AlertResourceDependencyModal.button.cancel")}
            </Button>
            <Button
              colorScheme={primaryColor}
              onClick={downloadOriginalResource}
            >
              {t("AlertResourceDependencyModal.button.continue")}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AlertResourceDependencyModal;

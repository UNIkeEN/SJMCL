import {
  Badge,
  Center,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BeatLoader } from "react-spinners";
import Empty from "@/components/common/empty";
import StructDataTree from "@/components/common/struct-data-tree";
import { useToast } from "@/contexts/toast";
import { LevelData } from "@/models/instance/world";
import { InstanceService } from "@/services/instance";

interface WorldLevelDataModalProps extends Omit<ModalProps, "children"> {
  instanceId: string | undefined;
  worldName: string;
}

const WorldLevelDataModal: React.FC<WorldLevelDataModalProps> = ({
  instanceId,
  worldName,
  ...props
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [levelData, setLevelData] = useState<LevelData>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { isOpen, onClose } = props;

  const handleRetrieveWorldDetails = useCallback(
    (instanceId: string, worldName: string) => {
      setIsLoading(true);
      InstanceService.retrieveWorldDetails(instanceId, worldName).then(
        (response) => {
          if (response.status === "success") {
            setLevelData(response.data);
          } else {
            setLevelData(undefined);
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        }
      );
      setIsLoading(false);
    },
    [toast]
  );

  useEffect(() => {
    if (isOpen) {
      if (!worldName) onClose();
      else if (instanceId !== undefined)
        handleRetrieveWorldDetails(instanceId, worldName);
    }
  }, [handleRetrieveWorldDetails, instanceId, worldName, isOpen, onClose]);

  return (
    <Modal
      autoFocus={false}
      size={{ base: "md", lg: "lg", xl: "xl" }}
      scrollBehavior="inside"
      {...props}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack>
            <Text>{t("WorldLevelDataModal.header.title", { worldName })}</Text>
            <Badge colorScheme="purple">Beta</Badge>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody className="allow-select">
          {levelData && <StructDataTree data={levelData} />}
          {!levelData && !isLoading && <Empty withIcon={false} size="sm" />}
          {isLoading && (
            <Center>
              <BeatLoader size={16} color="gray" />
            </Center>
          )}
        </ModalBody>

        <ModalFooter />
      </ModalContent>
    </Modal>
  );
};

export default WorldLevelDataModal;

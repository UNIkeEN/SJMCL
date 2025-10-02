import {
  Button,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ModLoaderSelector } from "@/components/mod-loader-selector";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import {
  ModLoaderResourceInfo,
  defaultModLoaderResourceInfo,
} from "@/models/resource";
import { InstanceService } from "@/services/instance";

interface ChangeModLoaderModalProps extends Omit<ModalProps, "children"> {
  instanceId: string;
  gameVersion: string;
}

export const ChangeModLoaderModal: React.FC<ChangeModLoaderModalProps> = ({
  instanceId,
  gameVersion,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const toast = useToast();

  const [selectedModLoader, setSelectedModLoader] =
    useState<ModLoaderResourceInfo>(defaultModLoaderResourceInfo);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setSelectedModLoader(defaultModLoaderResourceInfo);
  }, [gameVersion]);

  const handleChangeModLoader = async () => {
    setIsLoading(true);
    try {
      const res = await InstanceService.changeModLoader(
        instanceId,
        selectedModLoader
      );
      if (res.status === "success") {
        toast({
          title: t("ChangeModLoaderModal.success"),
          status: "success",
        });
        modalProps.onClose();
      } else {
        toast({
          title: res.message,
          description: res.details,
          status: "error",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal scrollBehavior="inside" size="2xl" {...modalProps}>
      <ModalOverlay />
      <ModalContent h="80vh">
        <ModalHeader>{t("ChangeModLoaderModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <Flex flexDir="column" h="100%">
          <ModalBody>
            <ModLoaderSelector
              selectedGameVersion={{
                id: gameVersion,
                gameType: "release",
                releaseTime: new Date().toISOString(),
                url: "",
              }}
              selectedModLoader={selectedModLoader}
              onSelectModLoader={setSelectedModLoader}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={modalProps.onClose}>
              {t("General.cancel")}
            </Button>
            <Button
              colorScheme={primaryColor}
              onClick={handleChangeModLoader}
              isLoading={isLoading}
              disabled={!selectedModLoader.version}
            >
              {t("General.download")}
            </Button>
          </ModalFooter>
        </Flex>
      </ModalContent>
    </Modal>
  );
};

import {
  Button,
  Flex,
  HStack,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Skeleton,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ModLoaderSelector } from "@/components/mod-loader-selector";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { useToast } from "@/contexts/toast";
import { ModLoaderType } from "@/enums/instance";
import {
  ModLoaderResourceInfo,
  defaultModLoaderResourceInfo,
} from "@/models/resource";
import { InstanceService } from "@/services/instance";

const modLoaderIcons: Record<string, string> = {
  Fabric: "/images/icons/Fabric.png",
  Forge: "/images/icons/Anvil.png",
  NeoForge: "/images/icons/NeoForge.png",
};

export const ChangeModLoaderModal: React.FC<Omit<ModalProps, "children">> = ({
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const { summary } = useInstanceSharedData();
  const primaryColor = config.appearance.theme.primaryColor;
  const toast = useToast();

  const [selectedModLoader, setSelectedModLoader] =
    useState<ModLoaderResourceInfo>(defaultModLoaderResourceInfo);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setSelectedModLoader(defaultModLoaderResourceInfo);
  }, [summary?.version]);

  const currentModLoader: ModLoaderResourceInfo = useMemo(() => {
    if (!summary?.modLoader)
      return {
        ...defaultModLoaderResourceInfo,
        loaderType: ModLoaderType.Unknown,
      };
    return {
      loaderType: summary.modLoader.loaderType,
      version: summary.modLoader.version || "",
      description: "",
      stable: true,
    };
  }, [summary]);

  const handleChangeModLoader = async () => {
    if (!summary?.id) return;
    setIsLoading(true);

    try {
      const res = await InstanceService.changeModLoader(
        summary.id,
        selectedModLoader
      );

      toast({
        title: res.message,
        status: res.status,
      });

      if (res.status === "success") modalProps.onClose?.();
    } finally {
      setIsLoading(false);
    }
  };

  const isSameLoader =
    selectedModLoader.loaderType === currentModLoader.loaderType &&
    selectedModLoader.version === currentModLoader.version;

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="80vh">
        <ModalHeader>{t("ChangeModLoaderModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <Flex flexDir="column" h="100%">
          <HStack spacing={8} justify="center" px={6} py={4}>
            <HStack align="center" spacing={1}>
              <Image
                src={modLoaderIcons[currentModLoader.loaderType]}
                alt={currentModLoader.loaderType}
                boxSize="36px"
                borderRadius="4px"
              />
              <Text>
                {currentModLoader.loaderType} {currentModLoader.version}
              </Text>
            </HStack>

            <Text fontSize="2xl" fontWeight="bold">
              →
            </Text>

            <HStack spacing={3} align="center">
              {selectedModLoader.loaderType === "Unknown" ? (
                <>
                  <Skeleton boxSize="36px" borderRadius="4px" />
                  <Text>{t("ChangeModLoaderModal.notSelectedLoader")}</Text>
                </>
              ) : (
                <>
                  <Image
                    src={`/images/icons/${selectedModLoader.loaderType}.png`}
                    alt={selectedModLoader.loaderType}
                    boxSize="36px"
                    borderRadius="4px"
                  />
                  <Text>
                    {selectedModLoader.loaderType}{" "}
                    {selectedModLoader.version ||
                      t("ChangeModLoaderModal.notSelectedVersion")}
                  </Text>
                </>
              )}
            </HStack>
          </HStack>

          <ModalBody>
            {summary?.version && (
              <ModLoaderSelector
                selectedGameVersion={{
                  id: summary.version,
                  gameType: "release",
                  releaseTime: new Date().toISOString(),
                  url: "",
                }}
                selectedModLoader={selectedModLoader}
                onSelectModLoader={setSelectedModLoader}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={modalProps.onClose}>
              {t("General.cancel")}
            </Button>
            <Button
              colorScheme={primaryColor}
              onClick={handleChangeModLoader}
              isLoading={isLoading}
              isDisabled={!selectedModLoader.version || isSameLoader}
            >
              {t("General.confirm")}
            </Button>
          </ModalFooter>
        </Flex>
      </ModalContent>
    </Modal>
  );
};

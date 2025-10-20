import {
  Box,
  Button,
  Flex,
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
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowRight } from "react-icons/lu";
import { OptionItem } from "@/components/common/option-item";
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

interface ChangeModLoaderModalProps extends Omit<ModalProps, "children"> {
  defaultSelectedType?: ModLoaderType;
}

export const ChangeModLoaderModal: React.FC<ChangeModLoaderModalProps> = ({
  defaultSelectedType,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const { summary } = useInstanceSharedData();
  const primaryColor = config.appearance.theme.primaryColor;
  const toast = useToast();
  const router = useRouter();

  const [selectedModLoader, setSelectedModLoader] =
    useState<ModLoaderResourceInfo>(defaultModLoaderResourceInfo);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (defaultSelectedType && defaultSelectedType !== ModLoaderType.Unknown) {
      setSelectedModLoader({
        ...defaultModLoaderResourceInfo,
        loaderType: defaultSelectedType,
      });
    } else {
      setSelectedModLoader(defaultModLoaderResourceInfo);
    }
  }, [summary?.version, defaultSelectedType]);

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

      if (res.status === "error") {
        toast({
          title: res.message,
          status: "error",
        });
      } else {
        modalProps.onClose?.();
        router.push("/downloads");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isUnselected =
    !selectedModLoader.version ||
    selectedModLoader.loaderType === ModLoaderType.Unknown;

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      onCloseComplete={() => {
        setSelectedModLoader(defaultModLoaderResourceInfo);
      }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="80vh">
        <ModalHeader>{t("ChangeModLoaderModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <Flex flexDir="column" h="100%">
          <Flex position="relative" align="center" justify="center" py={2}>
            <Flex flex="1" justify="flex-end" pr={8}>
              <OptionItem
                prefixElement={
                  currentModLoader.loaderType !== "Unknown" ? (
                    <Image
                      src={`/images/icons/${currentModLoader.loaderType}.png`}
                      alt={currentModLoader.loaderType}
                      boxSize="36px"
                      borderRadius="md"
                    />
                  ) : (
                    <Skeleton boxSize="36px" borderRadius="md" />
                  )
                }
                title={
                  <Text fontSize="sm" fontWeight="medium">
                    {currentModLoader.loaderType}
                  </Text>
                }
                description={
                  <Text fontSize="xs" color="gray.500">
                    {currentModLoader.version}
                  </Text>
                }
              />
            </Flex>

            <Box position="absolute" left="50%" transform="translateX(-50%)">
              <LuArrowRight size={18} />
            </Box>

            <Flex flex="1" justify="flex-start" pl={8}>
              {isUnselected ? (
                <OptionItem
                  prefixElement={<Skeleton boxSize="36px" borderRadius="md" />}
                  title={
                    <Text fontSize="sm" fontWeight="medium" color="gray.500">
                      {t("ChangeModLoaderModal.notSelectedLoader")}
                    </Text>
                  }
                />
              ) : (
                <OptionItem
                  prefixElement={
                    <Image
                      src={`/images/icons/${selectedModLoader.loaderType}.png`}
                      alt={selectedModLoader.loaderType}
                      boxSize="36px"
                      borderRadius="md"
                    />
                  }
                  title={
                    <Text fontSize="sm" fontWeight="medium">
                      {selectedModLoader.loaderType}
                    </Text>
                  }
                  description={
                    <Text fontSize="xs" color="gray.500">
                      {selectedModLoader.version}
                    </Text>
                  }
                />
              )}
            </Flex>
          </Flex>
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
              isDisabled={isUnselected}
            >
              {t("General.confirm")}
            </Button>
          </ModalFooter>
        </Flex>
      </ModalContent>
    </Modal>
  );
};

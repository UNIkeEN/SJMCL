import {
  Box,
  Button,
  Checkbox,
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
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowRight } from "react-icons/lu";
import { OptionItem } from "@/components/common/option-item";
import { LoaderSelector } from "@/components/loader-selector";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useInstanceSharedData } from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { ModLoaderType } from "@/enums/instance";
import {
  ModLoaderResourceInfo,
  OptiFineResourceInfo,
  defaultModLoaderResourceInfo,
} from "@/models/resource";
import { InstanceService } from "@/services/instance";
import { parseModLoaderVersion } from "@/utils/instance";

type Mode = "modloader" | "optifine";

interface ChangeLoaderModalProps extends Omit<ModalProps, "children"> {
  defaultSelectedType?: ModLoaderType;
  mode?: Mode;
}

export const ChangeLoaderModal: React.FC<ChangeLoaderModalProps> = ({
  defaultSelectedType,
  mode = "modloader",
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const { getInstanceList } = useGlobalData();
  const { summary, getLocalModList } = useInstanceSharedData();
  const primaryColor = config.appearance.theme.primaryColor;
  const { openGenericConfirmDialog } = useSharedModals();
  const toast = useToast();
  const router = useRouter();

  const [selectedModLoader, setSelectedModLoader] =
    useState<ModLoaderResourceInfo>(defaultModLoaderResourceInfo);
  const [selectedOptifine, setSelectedOptifine] = useState<
    OptiFineResourceInfo | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isInstallFabricApi, setIsInstallFabricApi] = useState(true);
  const [isInstallQfApi, setIsInstallQfApi] = useState(true);

  useEffect(() => {
    if (mode === "modloader") {
      if (
        defaultSelectedType &&
        defaultSelectedType !== ModLoaderType.Unknown
      ) {
        setSelectedModLoader({
          ...defaultModLoaderResourceInfo,
          loaderType: defaultSelectedType,
        });
      } else {
        setSelectedModLoader(defaultModLoaderResourceInfo);
      }
    }

    if (mode === "optifine") {
      setSelectedOptifine(undefined);
    }

    setIsInstallFabricApi(true);
    setIsInstallQfApi(true);
  }, [modalProps.isOpen, summary?.version, defaultSelectedType, mode]);

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
    };
  }, [summary]);

  const handleChangeModLoader = async () => {
    if (!summary?.id) return;
    setIsLoading(true);

    try {
      const res =
        mode === "modloader"
          ? await InstanceService.changeModLoader(
              summary.id,
              selectedModLoader,
              isInstallFabricApi,
              isInstallQfApi
            )
          : selectedOptifine
            ? await InstanceService.changeOptiFine(summary.id, selectedOptifine)
            : null;

      if (!res) return;
      if (res.status === "error") {
        toast({
          title: res.message,
          status: "error",
          description: res.details,
        });
      } else {
        modalProps.onClose?.();
        router.push("/downloads");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCurrentInstallation = () => {
    if (!summary?.id) return;

    const tKey =
      mode === "modloader" ? "RemoveModLoaderDialog" : "RemoveOptifineDialog";

    const dialogBody =
      mode === "modloader"
        ? t(`${tKey}.dialog.content`, {
            instanceName: summary.name,
            type: currentModLoader.loaderType,
            version: parseModLoaderVersion(currentModLoader.version),
          })
        : t(`${tKey}.dialog.content`, {
            instanceName: summary.name,
            version: summary?.optifine?.version || "",
          });

    openGenericConfirmDialog({
      title: t(`${tKey}.dialog.title`),
      body: dialogBody,
      btnOK: t("General.delete"),
      isAlert: true,
      onOKCallback: async () => {
        const res =
          mode === "modloader"
            ? await InstanceService.removeModLoader(summary.id!)
            : await InstanceService.removeOptifine(summary.id!);
        if (res.status === "error") {
          toast({
            title: res.message,
            description: res.details,
            status: "error",
          });
        } else {
          toast({
            title: res.message,
            status: "success",
          });
          modalProps.onClose?.();
          getInstanceList(true); // refresh instance info
          getLocalModList(true); // refresh local mod list
        }
      },
    });
  };

  const isNewLoaderUnselected =
    !selectedModLoader.version ||
    selectedModLoader.loaderType === ModLoaderType.Unknown;

  const isSameAsCurrent =
    mode === "modloader"
      ? selectedModLoader.loaderType === currentModLoader.loaderType &&
        parseModLoaderVersion(selectedModLoader.version) ===
          parseModLoaderVersion(currentModLoader.version)
      : summary?.optifine &&
        selectedOptifine &&
        summary.optifine.version ===
          `${selectedOptifine.type}_${selectedOptifine.patch}`;

  const isDisabled =
    mode === "modloader" ? isNewLoaderUnselected : !selectedOptifine;

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      returnFocusOnClose={false}
      onCloseComplete={() => {
        setSelectedModLoader(defaultModLoaderResourceInfo);
        setSelectedOptifine(undefined);
      }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
        <ModalHeader>
          {t(
            `ChangeLoaderModal.header.${mode}.title.${
              mode === "modloader"
                ? currentModLoader.loaderType === "Unknown"
                  ? "install"
                  : "change"
                : !summary?.optifine
                  ? "install"
                  : "change"
            }`
          )}
        </ModalHeader>
        <ModalCloseButton />

        {mode === "modloader" && currentModLoader.loaderType !== "Unknown" && (
          <Flex position="relative" align="center" justify="center" py={2}>
            <Flex flex="1" justify="flex-end" pr={8}>
              <OptionItem
                prefixElement={
                  <Image
                    src={`/images/icons/${currentModLoader.loaderType}.png`}
                    alt={currentModLoader.loaderType}
                    boxSize="36px"
                    borderRadius="md"
                  />
                }
                title={
                  <Text fontSize="sm" fontWeight="medium">
                    {currentModLoader.loaderType}
                  </Text>
                }
                description={
                  <Text fontSize="xs" color="gray.500">
                    {parseModLoaderVersion(currentModLoader.version)}
                  </Text>
                }
              />
            </Flex>
            <Box position="absolute" left="50%" transform="translateX(-50%)">
              <LuArrowRight size={18} />
            </Box>
            <Flex flex="1" justify="flex-start" pl={8}>
              {isNewLoaderUnselected ? (
                <OptionItem
                  prefixElement={<Skeleton boxSize="36px" borderRadius="md" />}
                  title={
                    <Text fontSize="sm" fontWeight="medium" color="gray.500">
                      {t("ChangeLoaderModal.notSelectedLoader")}
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
                      {parseModLoaderVersion(selectedModLoader.version)}
                    </Text>
                  }
                />
              )}
            </Flex>
          </Flex>
        )}
        <ModalBody
          flex="1"
          display="flex"
          flexDirection="column"
          overflow="hidden"
          minH={0}
        >
          {mode === "modloader" && summary?.version && (
            <Box flex="1" minH={0} display="flex">
              <LoaderSelector
                selectedGameVersion={{
                  id: summary.version,
                  gameType: "release",
                  releaseTime: new Date().toISOString(),
                  url: "",
                }}
                selectedModLoader={selectedModLoader}
                onSelectModLoader={setSelectedModLoader}
              />
            </Box>
          )}
          {mode === "optifine" && summary?.version && summary?.optifine && (
            <Flex position="relative" align="center" justify="center" py={2}>
              <Flex flex="1" justify="flex-end" pr={8}>
                <OptionItem
                  prefixElement={
                    <Image
                      src={`/images/icons/OptiFine.png`}
                      alt="OptiFine"
                      boxSize="36px"
                      borderRadius="md"
                    />
                  }
                  title={
                    <Text fontSize="sm" fontWeight="medium">
                      OptiFine
                    </Text>
                  }
                  description={
                    <Text fontSize="xs" color="gray.500">
                      {summary.optifine.version}
                    </Text>
                  }
                />
              </Flex>

              <Box position="absolute" left="50%" transform="translateX(-50%)">
                <LuArrowRight size={18} />
              </Box>

              <Flex flex="1" justify="flex-start" pl={8}>
                {!selectedOptifine || !selectedOptifine.filename ? (
                  <OptionItem
                    prefixElement={
                      <Skeleton boxSize="36px" borderRadius="md" />
                    }
                    title={
                      <Text fontSize="sm" fontWeight="medium" color="gray.500">
                        {t("ChangeLoaderModal.notSelectedOptifine")}
                      </Text>
                    }
                  />
                ) : (
                  <OptionItem
                    prefixElement={
                      <Image
                        src={`/images/icons/OptiFine.png`}
                        alt="OptiFine"
                        boxSize="36px"
                        borderRadius="md"
                      />
                    }
                    title={
                      <Text fontSize="sm" fontWeight="medium">
                        OptiFine
                      </Text>
                    }
                    description={
                      <Text fontSize="xs" color="gray.500">
                        {selectedOptifine.type + "_" + selectedOptifine.patch}
                      </Text>
                    }
                  />
                )}
              </Flex>
            </Flex>
          )}
          {mode === "optifine" && summary?.version && (
            <LoaderSelector
              selectedGameVersion={{
                id: summary.version,
                gameType: "release",
                releaseTime: new Date().toISOString(),
                url: "",
              }}
              selectedModLoader={defaultModLoaderResourceInfo}
              onSelectModLoader={() => {}}
              selectedOptiFine={selectedOptifine || undefined}
              onSelectOptiFine={(opt) => setSelectedOptifine(opt)}
              mode="optifine"
            />
          )}
        </ModalBody>
        <ModalFooter>
          {mode === "modloader" &&
            selectedModLoader.loaderType === ModLoaderType.Fabric && (
              <Checkbox
                colorScheme={primaryColor}
                isChecked={
                  selectedModLoader.version !== "" && isInstallFabricApi
                }
                disabled={!selectedModLoader.version}
                onChange={(e) => setIsInstallFabricApi(e.target.checked)}
              >
                <Text fontSize="sm">
                  {t("ChangeLoaderModal.footer.installFabricApi")}
                </Text>
              </Checkbox>
            )}

          {mode === "modloader" &&
            selectedModLoader.loaderType === ModLoaderType.Quilt && (
              <Checkbox
                colorScheme={primaryColor}
                isChecked={selectedModLoader.version !== "" && isInstallQfApi}
                disabled={!selectedModLoader.version}
                onChange={(e) => setIsInstallQfApi(e.target.checked)}
              >
                <Text fontSize="sm">
                  {t("ChangeLoaderModal.footer.installQFAPI")}
                </Text>
              </Checkbox>
            )}

          <HStack spacing={3} ml="auto">
            <Button variant="ghost" onClick={modalProps.onClose}>
              {t("General.cancel")}
            </Button>

            {isDisabled &&
              (mode === "modloader"
                ? currentModLoader.loaderType !== "Unknown"
                : !!summary?.optifine) && (
                <Button
                  variant="ghost"
                  onClick={handleRemoveCurrentInstallation}
                >
                  {t("ChangeLoaderModal.footer.removeCurrentInstallation")}
                </Button>
              )}

            <Button
              colorScheme={primaryColor}
              onClick={handleChangeModLoader}
              isLoading={isLoading}
              isDisabled={isDisabled}
            >
              {isSameAsCurrent
                ? t("ChangeLoaderModal.footer.reinstall")
                : t("General.confirm")}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

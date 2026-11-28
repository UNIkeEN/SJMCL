import {
  Box,
  Button,
  Center,
  Checkbox,
  Flex,
  HStack,
  Icon,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Radio,
  RadioGroup,
  Spinner,
  Step,
  StepIcon,
  StepIndicator,
  StepNumber,
  StepSeparator,
  StepStatus,
  StepTitle,
  Stepper,
  Text,
  VStack,
} from "@chakra-ui/react";
import { save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFolder } from "react-icons/lu";
import Empty from "@/components/common/empty";
import { useLauncherConfig } from "@/contexts/config";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import {
  ServerExportModInfo,
  ServerExportPlan,
  ServerModSide,
} from "@/models/instance/misc";
import { InstanceService } from "@/services/instance";
import { isFileNameSanitized, sanitizeFileName } from "@/utils/string";

interface ExportServerModalProps extends Omit<ModalProps, "children"> {
  instanceId: string;
  instanceName: string;
}

const sideColorMap: Record<ServerModSide, string> = {
  required: "green.500",
  optional: "blue.500",
  unknown: "yellow.500",
  unsupported: "red.500",
};

const ExportServerModal: React.FC<ExportServerModalProps> = ({
  instanceId,
  instanceName,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const { openGenericConfirmDialog, closeSharedModal } = useSharedModals();
  const primaryColor = config.appearance.theme.primaryColor;

  const [serverPackName, setServerPackName] = useState(
    `${instanceName}-server`
  );
  const [keepSave, setKeepSave] = useState("none");
  const [acceptEula, setAcceptEula] = useState(false);
  const [downloadAndInstall, setDownloadAndInstall] = useState(true);
  const [plan, setPlan] = useState<ServerExportPlan | null>(null);
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(
    new Set()
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const stepKeys = useMemo(() => {
    if (!plan) return ["basic", "files"];
    return plan.hasModLoader ? ["basic", "mods", "files"] : ["basic", "files"];
  }, [plan]);

  const currentStep = stepKeys[activeStep] ?? "basic";

  useEffect(() => {
    if (activeStep >= stepKeys.length) {
      setActiveStep(Math.max(0, stepKeys.length - 1));
    }
  }, [activeStep, stepKeys.length]);

  const checkNameError = useCallback((value: string): number => {
    if (value.trim() === "") return 1;
    if (!isFileNameSanitized(value)) return 2;
    if (value.length > 255) return 3;
    return 0;
  }, []);

  const handleAnalyzeServerExport = useCallback(
    async (instanceId: string) => {
      setPlan(null);
      setKeepSave("none");
      setAcceptEula(false);
      setDownloadAndInstall(true);
      setSelectedMods(new Set());
      setSelectedFolders(new Set());
      setServerPackName(`${instanceName}-server`);
      setIsAnalyzing(true);
      setActiveStep(0);

      try {
        const response = await InstanceService.analyzeServerExport(instanceId);
        if (response.status === "success") {
          setPlan(response.data);
          if (!response.data.supportsServerInstall) {
            setDownloadAndInstall(false);
          }
          setSelectedMods(
            new Set(
              response.data.mods
                .filter(
                  (mod) =>
                    mod.enabled &&
                    (mod.side === "required" ||
                      mod.side === "optional" ||
                      mod.side === "unknown")
                )
                .map((mod) => mod.path)
            )
          );
          setSelectedFolders(new Set(response.data.checkedFolders));
        } else {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
      } catch (error) {
        toast({
          title: t("Services.instance.analyzeServerExport.error.title"),
          description: String(error),
          status: "error",
        });
      } finally {
        setIsAnalyzing(false);
      }
    },
    [instanceName, t, toast]
  );

  useEffect(() => {
    if (!modalProps.isOpen) return;
    handleAnalyzeServerExport(instanceId);
  }, [handleAnalyzeServerExport, instanceId, modalProps.isOpen]);

  const toggleMod = useCallback(
    (mod: ServerExportModInfo, checked: boolean) => {
      if (!checked) {
        setSelectedMods((prev) => {
          const next = new Set(prev);
          next.delete(mod.path);
          return next;
        });
        return;
      }

      if (mod.side === "unsupported") {
        openGenericConfirmDialog({
          title: t("ExportServerModal.mods.unsupportedConfirm.title"),
          body: t("ExportServerModal.mods.unsupportedConfirm.body", {
            name: mod.name || mod.path,
          }),
          btnCancel: t("General.cancel"),
          onOKCallback: () => {
            closeSharedModal("generic-confirm");
            setSelectedMods((prev) => new Set(prev).add(mod.path));
          },
        });
        return;
      }

      setSelectedMods((prev) => new Set(prev).add(mod.path));
    },
    [closeSharedModal, openGenericConfirmDialog, t]
  );

  const handleNext = useCallback(() => {
    if (currentStep === "basic") {
      if (checkNameError(serverPackName) !== 0) {
        toast({
          title: t("ExportServerModal.error.invalidName"),
          status: "warning",
        });
        return;
      }
      if (!acceptEula) {
        toast({
          title: t("ExportServerModal.error.eulaNotAccepted"),
          status: "warning",
        });
        return;
      }
    }
    setActiveStep((prev) => Math.min(prev + 1, stepKeys.length - 1));
  }, [
    acceptEula,
    checkNameError,
    currentStep,
    serverPackName,
    stepKeys.length,
    t,
    toast,
  ]);

  const handleExport = useCallback(async () => {
    const savePath = await save({
      defaultPath: `${sanitizeFileName(serverPackName)}.zip`,
      filters: [
        {
          name: "Zip",
          extensions: ["zip"],
        },
      ],
    });

    if (!savePath) {
      return; // User cancelled
    }

    setIsLoading(true);

    try {
      const response = await InstanceService.exportServerPack(
        instanceId,
        savePath,
        {
          name: serverPackName,
          keepSave: keepSave === "none" ? undefined : keepSave,
          acceptEula,
          downloadAndInstall,
        },
        Array.from(selectedMods),
        Array.from(selectedFolders)
      );

      if (response.status === "success") {
        toast({
          title: response.message,
          status: "success",
        });
        modalProps.onClose?.();
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    } catch (error) {
      toast({
        title: t("Services.instance.exportServerPack.error.title"),
        description: String(error),
        status: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    acceptEula,
    downloadAndInstall,
    instanceId,
    keepSave,
    modalProps,
    selectedFolders,
    selectedMods,
    serverPackName,
    t,
    toast,
  ]);

  const step1Content = (
    <VStack spacing={4} align="stretch">
      <Box>
        <Text className="secondary-text" fontSize="xs-sm" mb={1}>
          {t("ExportServerModal.label.serverPackName")}
        </Text>
        <Input
          size="xs"
          value={serverPackName}
          onChange={(e) => setServerPackName(e.target.value)}
          fontSize="xs-sm"
          focusBorderColor={`${primaryColor}.500`}
          isInvalid={checkNameError(serverPackName) !== 0}
        />
      </Box>
      <Box>
        <Checkbox
          colorScheme={primaryColor}
          isChecked={downloadAndInstall}
          isDisabled={plan ? !plan.supportsServerInstall : false}
          onChange={(e) => setDownloadAndInstall(e.target.checked)}
          size="sm"
        >
          <Text fontSize="xs-sm">
            {t("ExportServerModal.label.downloadAndInstall")}
          </Text>
        </Checkbox>
        {downloadAndInstall && (
          <Text className="secondary-text" fontSize="xs" mt={1}>
            {t("ExportServerModal.downloadAndInstall.proxyHint")}
          </Text>
        )}
      </Box>
      <Box>
        <Text className="secondary-text" fontSize="xs-sm" mb={1}>
          {t("ExportServerModal.label.eula")}
        </Text>
        <Checkbox
          colorScheme={primaryColor}
          isChecked={acceptEula}
          onChange={(e) => setAcceptEula(e.target.checked)}
          size="sm"
        >
          <HStack spacing={1} fontSize="xs-sm">
            <Text>{t("ExportServerModal.eula.agree")}</Text>
            <Link
              color={`${primaryColor}.500`}
              fontSize="xs-sm"
              cursor="pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openUrl("https://aka.ms/MinecraftEULA");
              }}
            >
              Minecraft EULA
            </Link>
          </HStack>
        </Checkbox>
        <Text color="yellow.500" fontSize="xs" mt={1}>
          {t("ExportServerModal.eula.warning")}
        </Text>
      </Box>
    </VStack>
  );

  const step2Content = (
    <VStack spacing={4} align="stretch">
      {plan && plan.mods.length > 0 ? (
        <Box w="100%" maxH="sm" overflowY="auto">
          <VStack align="stretch" spacing={1}>
            {plan.mods.map((mod) => (
              <Checkbox
                key={mod.path}
                colorScheme={primaryColor}
                isChecked={selectedMods.has(mod.path)}
                isDisabled={!mod.enabled}
                onChange={(e) => toggleMod(mod, e.target.checked)}
                size="sm"
              >
                <HStack spacing={1} fontSize="xs-sm">
                  <Text className="ellipsis-text">{mod.name || mod.path}</Text>
                  <Text color={sideColorMap[mod.side]} fontSize="xs">
                    {t(`ExportServerModal.mods.${mod.side}`)}
                  </Text>
                  {mod.uncertain && (
                    <Text color="gray.500" fontSize="xs">
                      {t("ExportServerModal.mods.requiredOrOptionalSuffix")}
                    </Text>
                  )}
                </HStack>
              </Checkbox>
            ))}
          </VStack>
        </Box>
      ) : (
        <Empty withIcon={false} size="sm" />
      )}
    </VStack>
  );

  const step3Content = (
    <VStack spacing={4} align="stretch">
      {plan && plan.saves.length > 0 && (
        <Box>
          <Text className="secondary-text" fontSize="xs-sm" mb={1}>
            {t("ExportServerModal.label.keepSave")}
          </Text>
          <RadioGroup value={keepSave} onChange={setKeepSave}>
            <VStack align="stretch" spacing={1}>
              <Radio value="none" size="sm" colorScheme={primaryColor}>
                <Text fontSize="xs-sm">{t("ExportServerModal.save.none")}</Text>
              </Radio>
              {plan.saves.map((saveName) => (
                <Radio
                  key={saveName}
                  value={saveName}
                  size="sm"
                  colorScheme={primaryColor}
                >
                  <Text fontSize="xs-sm">{saveName}</Text>
                </Radio>
              ))}
            </VStack>
          </RadioGroup>
        </Box>
      )}

      {plan && plan.folders.length > 0 && (
        <Box>
          <Text className="secondary-text" fontSize="xs-sm" mb={1}>
            {t("ExportServerModal.label.folders")}
          </Text>
          <Box w="100%" maxH="xs" overflowY="auto">
            <VStack align="stretch" spacing={1}>
              {plan.folders.map((folder) => (
                <Checkbox
                  key={folder}
                  colorScheme={primaryColor}
                  isChecked={selectedFolders.has(folder)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectedFolders((prev) => {
                      const next = new Set(prev);
                      if (checked) {
                        next.add(folder);
                      } else {
                        next.delete(folder);
                      }
                      return next;
                    });
                  }}
                  size="sm"
                >
                  <HStack spacing={2} fontSize="xs-sm">
                    <Icon as={LuFolder} />
                    <Text className="ellipsis-text">{folder}</Text>
                  </HStack>
                </Checkbox>
              ))}
            </VStack>
          </Box>
        </Box>
      )}
    </VStack>
  );

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      returnFocusOnClose={false}
      closeOnOverlayClick={!isLoading}
      closeOnEsc={!isLoading}
      {...modalProps}
      onClose={() => {
        if (!isLoading) {
          modalProps.onClose?.();
        }
      }}
    >
      <ModalOverlay />
      <ModalContent maxH="calc(100vh - 7.5rem)">
        <ModalHeader>
          {t("ExportServerModal.header.title", { param: instanceName })}
        </ModalHeader>
        <ModalCloseButton />
        {isAnalyzing ? (
          <Center py={12}>
            <VStack spacing={3}>
              <Spinner
                size="lg"
                thickness="4px"
                color={`${primaryColor}.500`}
              />
              <Text className="secondary-text" fontSize="xs-sm">
                {t("ExportServerModal.mods.loading")}
              </Text>
            </VStack>
          </Center>
        ) : (
          <>
            <Center>
              <Stepper
                colorScheme={primaryColor}
                index={activeStep}
                w="80%"
                my={1.5}
                size="xs"
              >
                {stepKeys.map((key) => (
                  <Step key={key}>
                    <StepIndicator>
                      <StepStatus
                        complete={<StepIcon />}
                        incomplete={<StepNumber />}
                        active={<StepNumber />}
                      />
                    </StepIndicator>
                    <Box flexShrink="0">
                      <StepTitle fontSize="sm">
                        {t(`ExportServerModal.stepper.${key}`)}
                      </StepTitle>
                    </Box>
                    <StepSeparator />
                  </Step>
                ))}
              </Stepper>
            </Center>
            <ModalBody>
              <Flex flexDir="column">
                {currentStep === "basic" && step1Content}
                {currentStep === "mods" && step2Content}
                {currentStep === "files" && step3Content}
              </Flex>
            </ModalBody>
            <ModalFooter>
              <HStack spacing={2}>
                <Button
                  variant="ghost"
                  isDisabled={isLoading}
                  onClick={modalProps.onClose}
                >
                  {t("General.cancel")}
                </Button>
                {activeStep > 0 && (
                  <Button
                    variant="ghost"
                    isDisabled={isLoading}
                    onClick={() => setActiveStep((prev) => prev - 1)}
                  >
                    {t("General.previous")}
                  </Button>
                )}
                {activeStep < stepKeys.length - 1 ? (
                  <Button colorScheme={primaryColor} onClick={handleNext}>
                    {t("General.next")}
                  </Button>
                ) : (
                  <Button
                    colorScheme={primaryColor}
                    onClick={handleExport}
                    isLoading={isLoading}
                  >
                    {t("ExportServerModal.button.export")}
                  </Button>
                )}
              </HStack>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default ExportServerModal;

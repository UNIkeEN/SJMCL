import {
  Box,
  Button,
  Center,
  Checkbox,
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Step,
  StepDescription,
  StepIcon,
  StepIndicator,
  StepNumber,
  StepSeparator,
  StepStatus,
  StepTitle,
  Stepper,
  Text,
  useSteps,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GameVersionSelector } from "@/components/game-version-selector";
import { InstanceBasicSettings } from "@/components/instance-basic-settings";
import { LoaderSelector } from "@/components/loader-selector";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { ModLoaderType } from "@/enums/instance";
import { GameDirectory } from "@/models/config";
import {
  GameClientResourceInfo,
  ModLoaderResourceInfo,
  OptiFineResourceInfo,
  defaultModLoaderResourceInfo,
} from "@/models/resource";
import { InstanceService } from "@/services/instance";
import { parseModLoaderVersion } from "@/utils/instance";

export const gameTypesToIcon: Record<string, string> = {
  release: "/images/icons/JEIcon_Release.png",
  snapshot: "/images/icons/JEIcon_Snapshot.png",
  old_beta: "/images/icons/StoneOldBeta.png",
  april_fools: "/images/icons/YellowGlazedTerracotta.png",
};

export const loaderTypesToIcon: Record<string, string> = {
  Unknown: "",
  Fabric: "/images/icons/Fabric.png",
  Forge: "/images/icons/Anvil.png", // differ from that in mod-loader-selector
  NeoForge: "/images/icons/NeoForge.png",
  OptiFine: "/images/icons/OptiFine.png",
};

export const CreateInstanceModal: React.FC<Omit<ModalProps, "children">> = ({
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const toast = useToast();
  const router = useRouter();

  const { activeStep, setActiveStep } = useSteps({
    index: 0,
    count: 3,
  });

  const [selectedGameVersion, setSelectedGameVersion] =
    useState<GameClientResourceInfo>();
  const [selectedModLoader, setSelectedModLoader] =
    useState<ModLoaderResourceInfo>(defaultModLoaderResourceInfo);
  const [selectedOptiFine, setSelectedOptiFine] = useState<
    OptiFineResourceInfo | undefined
  >(undefined);
  const [instanceName, setInstanceName] = useState("");
  const [instanceDescription, setInstanceDescription] = useState("");
  const [instanceIconSrc, setInstanceIconSrc] = useState("");
  const [instanceDirectory, setInstanceDirectory] = useState<GameDirectory>();
  const [isLoading, setIsLoading] = useState(false);
  const [isInstallFabricApi, setIsInstallFabricApi] = useState(true);

  useEffect(() => {
    setSelectedModLoader(defaultModLoaderResourceInfo);
    setInstanceName("");
    setInstanceDescription("");
    setInstanceIconSrc(
      gameTypesToIcon[selectedGameVersion?.gameType || "release"]
    );
    setIsInstallFabricApi(true);
  }, [selectedGameVersion]);

  const handleCreateInstance = useCallback(() => {
    if (!selectedGameVersion || !instanceDirectory) return;

    setIsLoading(true);
    InstanceService.createInstance(
      instanceDirectory,
      instanceName,
      instanceDescription,
      instanceIconSrc,
      selectedGameVersion,
      selectedModLoader,
      selectedOptiFine,
      undefined, // modpackPath
      isInstallFabricApi
    )
      .then((res) => {
        if (res.status === "success") {
          // success toast will now be called by task context group listener
          modalProps.onClose();
          router.push("/downloads");
        } else {
          toast({
            title: res.message,
            description: res.details,
            status: "error",
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, [
    selectedGameVersion,
    instanceDirectory,
    instanceName,
    instanceDescription,
    instanceIconSrc,
    selectedModLoader,
    selectedOptiFine,
    isInstallFabricApi,
    modalProps,
    router,
    toast,
  ]);

  const step1Content = useMemo(() => {
    return (
      <>
        <ModalBody>
          <GameVersionSelector
            selectedVersion={selectedGameVersion}
            onVersionSelect={setSelectedGameVersion}
          />
        </ModalBody>
        <ModalFooter mt={1}>
          <Button variant="ghost" onClick={modalProps.onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            disabled={!selectedGameVersion}
            colorScheme={primaryColor}
            onClick={() => {
              setActiveStep(1);
            }}
          >
            {t("General.next")}
          </Button>
        </ModalFooter>
      </>
    );
  }, [modalProps.onClose, primaryColor, selectedGameVersion, setActiveStep, t]);

  const step2Content = useMemo(() => {
    return (
      selectedGameVersion && (
        <>
          <ModalBody>
            <LoaderSelector
              selectedGameVersion={selectedGameVersion}
              selectedModLoader={selectedModLoader}
              onSelectModLoader={setSelectedModLoader}
              selectedOptiFine={selectedOptiFine}
              onSelectOptiFine={setSelectedOptiFine}
            />
          </ModalBody>
          <ModalFooter>
            {/* Fabric API download option - only show when Fabric is selected and has version */}
            {selectedModLoader.loaderType === ModLoaderType.Fabric && (
              <Checkbox
                colorScheme={primaryColor}
                isChecked={
                  selectedModLoader.version !== "" && isInstallFabricApi
                }
                disabled={!selectedModLoader.version}
                onChange={(e) => setIsInstallFabricApi(e.target.checked)}
              >
                <Text fontSize="sm">
                  {t("CreateInstanceModal.footer.installFabricApi")}
                </Text>
              </Checkbox>
            )}

            <HStack spacing={3} ml="auto">
              <Button variant="ghost" onClick={modalProps.onClose}>
                {t("General.cancel")}
              </Button>
              <Button variant="ghost" onClick={() => setActiveStep(0)}>
                {t("General.previous")}
              </Button>
              <Button
                colorScheme={primaryColor}
                onClick={() => {
                  if (!selectedModLoader.version) {
                    // if the user selected the loader but did not choose a version from the list
                    setSelectedModLoader(defaultModLoaderResourceInfo);
                    setInstanceName(selectedGameVersion.id);
                    setInstanceIconSrc(
                      gameTypesToIcon[selectedGameVersion.gameType]
                    );
                  } else {
                    setInstanceName(
                      `${selectedGameVersion.id}-${selectedModLoader.loaderType}`
                    );
                    setInstanceIconSrc(
                      loaderTypesToIcon[selectedModLoader.loaderType]
                    );
                  }

                  if (selectedOptiFine) {
                    if (!selectedOptiFine.filename) {
                      // if the user selected OptiFine but did not choose a version from the list
                      setSelectedOptiFine(undefined);
                    } else {
                      setInstanceName((prev) => `${prev}-OptiFine`);
                      setInstanceIconSrc(loaderTypesToIcon["OptiFine"]);
                    }
                  }
                  setActiveStep(2);
                }}
              >
                {t("General.next")}
              </Button>
            </HStack>
          </ModalFooter>
        </>
      )
    );
  }, [
    selectedGameVersion,
    selectedModLoader,
    selectedOptiFine,
    primaryColor,
    isInstallFabricApi,
    t,
    modalProps.onClose,
    setActiveStep,
  ]);

  const step3Content = useMemo(() => {
    return (
      <>
        <ModalBody>
          <InstanceBasicSettings
            name={instanceName}
            setName={setInstanceName}
            description={instanceDescription}
            setDescription={setInstanceDescription}
            iconSrc={instanceIconSrc}
            setIconSrc={setInstanceIconSrc}
            gameDirectory={instanceDirectory}
            setGameDirectory={setInstanceDirectory}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={modalProps.onClose}>
            {t("General.cancel")}
          </Button>
          <Button variant="ghost" onClick={() => setActiveStep(1)}>
            {t("General.previous")}
          </Button>
          <Button
            disabled={!instanceDirectory || instanceName === ""}
            colorScheme={primaryColor}
            onClick={() => handleCreateInstance()}
            isLoading={isLoading}
          >
            {t("General.finish")}
          </Button>
        </ModalFooter>
      </>
    );
  }, [
    handleCreateInstance,
    instanceDescription,
    instanceDirectory,
    instanceIconSrc,
    instanceName,
    isLoading,
    modalProps.onClose,
    primaryColor,
    setActiveStep,
    t,
  ]);

  const steps = useMemo(
    () => [
      {
        key: "game",
        content: step1Content,
        description:
          selectedGameVersion &&
          `${selectedGameVersion.id} ${t(`GameVersionSelector.${selectedGameVersion.gameType}`)}`,
      },
      {
        key: "loader",
        content: step2Content,
        description: (() => {
          if (selectedModLoader.loaderType === ModLoaderType.Unknown) {
            return selectedOptiFine
              ? "OptiFine"
              : t("LoaderSelector.noVersionSelected");
          } else {
            let desc = `${selectedModLoader.loaderType} ${
              parseModLoaderVersion(selectedModLoader.version) ||
              t("LoaderSelector.noVersionSelected")
            }`;
            if (selectedOptiFine) {
              desc += ` + OptiFine`;
            }
            return desc;
          }
        })(),
      },
      {
        key: "info",
        content: step3Content,
        description: "",
      },
    ],
    [
      step1Content,
      selectedGameVersion,
      t,
      step2Content,
      step3Content,
      selectedModLoader.loaderType,
      selectedModLoader.version,
      selectedOptiFine,
    ]
  );

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
        <ModalHeader>{t("CreateInstanceModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <Center>
          <Stepper
            colorScheme={primaryColor}
            index={activeStep}
            w="80%"
            my={1.5}
          >
            {steps.map((step, index) => (
              <Step key={index}>
                <StepIndicator>
                  <StepStatus
                    complete={<StepIcon />}
                    incomplete={<StepNumber />}
                    active={<StepNumber />}
                  />
                </StepIndicator>
                <Box flexShrink="0">
                  <StepTitle fontSize="sm">
                    {t(`CreateInstanceModal.stepper.${step.key}`)}
                  </StepTitle>
                  <StepDescription fontSize="xs">
                    {index < activeStep && step.description}
                  </StepDescription>
                </Box>
                <StepSeparator />
              </Step>
            ))}
          </Stepper>
        </Center>
        <Flex flexGrow="1" flexDir="column" h="100%" overflow="auto">
          {steps[activeStep].content}
        </Flex>
      </ModalContent>
    </Modal>
  );
};

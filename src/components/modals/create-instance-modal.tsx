import {
  Box,
  Button,
  Center,
  Flex,
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
  useSteps,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GameVersionSelector } from "@/components/game-version-selector";
import { InstanceBasicSettings } from "@/components/instance-basic-settings";
import { ModLoaderSelector } from "@/components/mod-loader-selector";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useToast } from "@/contexts/toast";
import { GameDirectory } from "@/models/config";
import {
  GameResourceInfo,
  ModLoaderResourceInfo,
  defaultModLoaderResourceInfo,
} from "@/models/resource";
import { InstanceService } from "@/services/instance";

const gameTypesToIcon: Record<string, string> = {
  release: "/images/icons/JEIcon_Release.png",
  snapshot: "/images/icons/JEIcon_Snapshot.png",
  old_beta: "/images/icons/StoneOldBeta.png",
  april_fools: "/images/icons/YellowGlazedTerracotta.png",
};

const modLoaderTypesToIcon: Record<string, string> = {
  Unknown: "",
  Fabric: "/images/icons/Fabric.png",
  Forge: "/images/icons/Anvil.png", // differ from that in mod-loader-selector
  NeoForge: "/images/icons/NeoForge.png",
};

export const CreateInstanceModal: React.FC<Omit<ModalProps, "children">> = ({
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const { getInstanceList } = useGlobalData();
  const primaryColor = config.appearance.theme.primaryColor;
  const toast = useToast();
  const router = useRouter();

  const { activeStep, setActiveStep } = useSteps({
    index: 0,
    count: 3,
  });

  const [selectedGameVersion, setSelectedGameVersion] =
    useState<GameResourceInfo>();
  const [selectedModLoader, setSelectedModLoader] =
    useState<ModLoaderResourceInfo>(defaultModLoaderResourceInfo);
  const [instanceName, setInstanceName] = useState("");
  const [instanceDescription, setInstanceDescription] = useState("");
  const [instanceIconSrc, setInstanceIconSrc] = useState("");
  const [instanceDirectory, setInstanceDirectory] = useState<GameDirectory>();

  const handleDownloadInstance = useCallback(() => {
    if (!selectedGameVersion) return;
    InstanceService.downloadInstance(
      instanceDirectory!,
      instanceName,
      instanceDescription,
      instanceIconSrc,
      selectedGameVersion,
      {
        loaderType: selectedModLoader.loaderType,
        version: selectedModLoader.version,
      }
    ).then((res) => {
      if (res.status === "success") {
        toast({
          title: res.message,
          status: "success",
        });
        getInstanceList(true);
      } else {
        toast({
          title: res.message,
          description: res.details,
          status: "error",
        });
      }
    });
    modalProps.onClose();
    router.push("/downloads");
  }, [
    selectedGameVersion,
    instanceDirectory,
    instanceName,
    instanceDescription,
    instanceIconSrc,
    selectedModLoader.loaderType,
    selectedModLoader.version,
    modalProps,
    router,
    toast,
    getInstanceList,
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
            <ModLoaderSelector
              selectedGameVersion={selectedGameVersion}
              selectedModLoader={selectedModLoader}
              onSelectModLoader={setSelectedModLoader}
            />
          </ModalBody>
          <ModalFooter>
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
                  setSelectedModLoader(defaultModLoaderResourceInfo); // if the user selected the loader but did not choose a version from the list
                  setInstanceName(selectedGameVersion.id);
                  setInstanceIconSrc(
                    gameTypesToIcon[selectedGameVersion.gameType]
                  );
                } else {
                  setInstanceName(
                    `${selectedGameVersion.id}-${selectedModLoader.loaderType}`
                  );
                  setInstanceIconSrc(
                    modLoaderTypesToIcon[selectedModLoader.loaderType]
                  );
                }
                setActiveStep(2);
              }}
            >
              {t("General.next")}
            </Button>
          </ModalFooter>
        </>
      )
    );
  }, [
    modalProps.onClose,
    primaryColor,
    selectedGameVersion,
    selectedModLoader,
    setActiveStep,
    t,
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
            onClick={() => handleDownloadInstance()}
          >
            {t("General.finish")}
          </Button>
        </ModalFooter>
      </>
    );
  }, [
    handleDownloadInstance,
    instanceDescription,
    instanceDirectory,
    instanceIconSrc,
    instanceName,
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
        description:
          selectedModLoader.loaderType === "Unknown"
            ? t("CreateInstanceModal.stepper.skipped")
            : `${selectedModLoader.loaderType} ${selectedModLoader.version}`,
      },
      {
        key: "info",
        content: step3Content,
        description: "",
      },
    ],
    [
      step1Content,
      step2Content,
      step3Content,
      selectedGameVersion,
      selectedModLoader.loaderType,
      selectedModLoader.version,
      t,
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

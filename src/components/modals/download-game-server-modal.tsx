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
  Radio,
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
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import GameVersionSelector from "@/components/game-version-selector";
import { useLauncherConfig } from "@/contexts/config";
import { GameDirectory } from "@/models/config";
import { GameResourceInfo } from "@/models/resource";
import { OptionItemGroup } from "../common/option-item";

export const DownloadGameServerModal: React.FC<
  Omit<ModalProps, "children">
> = ({ ...modalProps }) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const { activeStep, setActiveStep } = useSteps({
    index: 0,
    count: 2,
  });

  const [selectedGameVersion, setSelectedGameVersion] =
    useState<GameResourceInfo>();
  const [instanceDirectory, setInstanceDirectory] = useState<GameDirectory>();

  const Step1Content = useMemo(() => {
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

  const Step2Content = useMemo(() => {
    return (
      <>
        <ModalBody>
          <OptionItemGroup
            items={config.localGameDirectories.map((directory) => ({
              title:
                directory.name === "CURRENT_DIR"
                  ? t(
                      "GlobalGameSettingsPage.directories.settings.directories.currentDir"
                    )
                  : directory.name,
              description: directory.dir,
              prefixElement: (
                <Radio
                  isChecked={directory.dir === instanceDirectory?.dir}
                  onChange={() => setInstanceDirectory(directory)}
                />
              ),
              children: <></>,
            }))}
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
            disabled={!instanceDirectory}
            colorScheme={primaryColor}
            onClick={modalProps.onClose}
          >
            {t("General.finish")}
          </Button>
        </ModalFooter>
      </>
    );
  }, [
    config.localGameDirectories,
    instanceDirectory,
    modalProps.onClose,
    primaryColor,
    setActiveStep,
    t,
  ]);

  const steps = useMemo(
    () => [
      {
        key: "server",
        content: Step1Content,
        description:
          selectedGameVersion &&
          `${selectedGameVersion.id} ${t(`GameVersionSelector.${selectedGameVersion.gameType}`)}`,
      },
      {
        key: "info",
        content: Step2Content,
        description: "",
      },
    ],
    [Step1Content, Step2Content, selectedGameVersion, t]
  );

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("DownloadGameServerModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <Center>
          <Stepper
            colorScheme={primaryColor}
            index={activeStep}
            w="50%"
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
                    {t(`DownloadGameServerModal.stepper.${step.key}`)}
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
        <Flex h="60vh" flexDir="column">
          {steps[activeStep].content}
        </Flex>
      </ModalContent>
    </Modal>
  );
};

import {
  Button,
  HStack,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Step,
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
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { useLauncherConfig } from "@/contexts/config";
import { useData } from "@/contexts/data";
import { GameInstanceSummary } from "@/models/instance/misc";
import { ResponseError } from "@/models/response";
import { AccountService } from "@/services/account";
import { LaunchService } from "@/services/launch";

// This modal will use shared-modal-context
interface LaunchProcessModal extends Omit<ModalProps, "children"> {
  instanceId: number; // may not be select instance id
}

const LaunchProcessModal: React.FC<LaunchProcessModal> = ({
  instanceId,
  ...props
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { selectedPlayer, getGameInstanceList } = useData();

  const [launchingInstance, setLaunchingInstance] =
    useState<GameInstanceSummary>();
  const [errorPaused, setErrorPaused] = useState<boolean>(false);

  useEffect(() => {
    setLaunchingInstance(
      getGameInstanceList()?.find((instance) => instance.id === instanceId)
    );
  }, [getGameInstanceList, instanceId]);

  const launchProcessSteps: Array<{
    label: string;
    function: () => Promise<any>;
    isOK: (data: any) => boolean;
    onResCallback: (data: any) => void; // TODO: change return type to bool? so we can back to process after some operations.
    onErrCallback: (error: ResponseError) => void;
  }> = useMemo(
    () => [
      {
        label: "validatePlayer",
        function: () => AccountService.validatePlayer(selectedPlayer?.id!),
        isOK: (data: any) => true,
        onResCallback: (data: any) => {},
        onErrCallback: (error: ResponseError) => {
          AccountService.refreshPlayer(selectedPlayer?.id!).then((response) => {
            if (response.status !== "success") {
              // todo: show re-login modal
              setErrorPaused(true);
            }
          });
        },
      },
      // TODO: check java version
      {
        label: "validateGameFiles",
        function: () => LaunchService.validateGameFiles(instanceId),
        isOK: (data: any) => data && data.length === 0,
        onResCallback: (data: any) => {}, // TODO
        onErrCallback: (error: ResponseError) => {}, // TODO
      },
      {
        label: "launchGame",
        function: () => LaunchService.launchGame(instanceId),
        isOK: (data: any) => true,
        onResCallback: (data: any) => {}, // TODO
        onErrCallback: (error: ResponseError) => {}, // TODO
      },
      // TODO: progress bar in last step, and cancel logic
    ],
    [instanceId, selectedPlayer?.id]
  );

  const { activeStep, setActiveStep } = useSteps({
    index: 0,
    count: launchProcessSteps.length,
  });

  useEffect(() => {
    if (activeStep >= launchProcessSteps.length) {
      return;
      // TODO
    }
    const currentStep = launchProcessSteps[activeStep];
    currentStep.function().then((response) => {
      if (response.status === "success") {
        if (currentStep.isOK(response.data)) {
          setActiveStep(activeStep + 1);
        } else {
          currentStep.onResCallback(response.data);
        }
      } else {
        setErrorPaused(true);
        currentStep.onErrCallback(response.error);
      }
    });
  }, [activeStep, setActiveStep, launchProcessSteps]);

  return (
    <Modal size="sm" closeOnEsc={false} closeOnOverlayClick={false} {...props}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {t("LaunchProcessModal.header.title", {
            name: launchingInstance?.name,
          })}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody minH="8rem">
          <Stepper
            index={activeStep}
            orientation="vertical"
            h="6rem"
            gap="0"
            size="sm"
            colorScheme={errorPaused ? "red" : primaryColor}
          >
            {launchProcessSteps.map((step, index) => (
              <Step key={index}>
                <StepIndicator>
                  <StepStatus
                    complete={<StepIcon />}
                    incomplete={<StepNumber />}
                    active={
                      errorPaused ? (
                        <Icon as={LuX} color="red.500" />
                      ) : (
                        <StepNumber />
                      )
                    }
                  />
                </StepIndicator>
                <StepTitle>
                  <HStack>
                    <Text>{t(`LaunchProcessModal.step.${step.label}`)}</Text>
                    {index === activeStep && !errorPaused && (
                      <BeatLoader size={12} color="gray" />
                    )}
                  </HStack>
                </StepTitle>
                <StepSeparator />
              </Step>
            ))}
          </Stepper>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={props.onClose}>
            {t("General.cancel")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default LaunchProcessModal;

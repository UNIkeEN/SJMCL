import {
  Box,
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
  StepDescription,
  StepIcon,
  StepIndicator,
  StepNumber,
  StepSeparator,
  StepStatus,
  StepTitle,
  Stepper,
  Text,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { InstanceSummary } from "@/models/instance/misc";
import { ResponseError } from "@/models/response";
import { AccountService } from "@/services/account";
import { LaunchService } from "@/services/launch";

// This modal will use shared-modal-context
interface LaunchProcessModal extends Omit<ModalProps, "children"> {
  instanceId: string; // may not be select instance id
  quickPlaySingleplayer?: string;
}

const LaunchProcessModal: React.FC<LaunchProcessModal> = ({
  instanceId,
  quickPlaySingleplayer,
  ...props
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { selectedPlayer, getInstanceList } = useGlobalData();
  const { openSharedModal } = useSharedModals();

  const [launchingInstance, setLaunchingInstance] = useState<InstanceSummary>();
  const [errorPaused, setErrorPaused] = useState<boolean>(false);
  const [errorDesc, setErrorDesc] = useState<string>("");
  const [activeStep, setActiveStep] = useState<number>(0);
  const previousStep = useRef<number>(-1);

  useEffect(() => {
    setLaunchingInstance(
      getInstanceList()?.find((instance) => instance.id === instanceId)
    );
  }, [getInstanceList, instanceId]);

  const handleCloseModalWithCancel = useCallback(() => {
    LaunchService.cancelLaunchProcess();
    setErrorPaused(false);
    props.onClose();
  }, [props]);

  const launchProcessSteps: Array<{
    label: string;
    function: () => Promise<any>;
    isOK: (data: any) => boolean;
    onResCallback: (data: any) => void; // TODO: change return type to bool? so we can back to process after some operations.
    onErrCallback: (error: ResponseError) => void;
  }> = useMemo(
    () => [
      {
        label: "selectSuitableJRE",
        function: () => LaunchService.selectSuitableJRE(instanceId),
        isOK: (data: any) => true,
        onResCallback: (data: any) => {},
        onErrCallback: (error: ResponseError) => {}, // TODO
      },
      {
        label: "validateGameFiles",
        function: () => LaunchService.validateGameFiles(),
        isOK: (data: any) => true,
        onResCallback: (data: any) => {}, // TODO
        onErrCallback: (error: ResponseError) => {
          handleCloseModalWithCancel();
          toast({
            title: error.message,
            description: error.details,
            status: "error",
          });
          router.push("/downloads");
        },
      },
      {
        label: "validateSelectedPlayer",
        function: () => LaunchService.validateSelectedPlayer(),
        isOK: (data: boolean) => data,
        onResCallback: (data: boolean) => {
          AccountService.refreshPlayer(selectedPlayer?.id || "").then(
            (response) => {
              if (response.status !== "success") {
                openSharedModal("relogin", {
                  player: selectedPlayer,
                  onSuccess: () => {
                    setActiveStep(activeStep + 1);
                  },
                  onError: () => {
                    setErrorPaused(true);
                    setErrorDesc(response.details);
                    console.error(response.details);
                  },
                });
              } else {
                setActiveStep(activeStep + 1);
              }
            }
          );
        },
        onErrCallback: (error: ResponseError) => {},
      },
      {
        label: "launchGame",
        function: () => LaunchService.launchGame(quickPlaySingleplayer),
        isOK: (data: any) => true,
        onResCallback: (data: any) => {},
        onErrCallback: (error: ResponseError) => {},
      },
    ],
    [
      activeStep,
      handleCloseModalWithCancel,
      instanceId,
      openSharedModal,
      quickPlaySingleplayer,
      router,
      selectedPlayer,
      toast,
    ]
  );

  useEffect(() => {
    if (!selectedPlayer) {
      toast({
        title: t("LaunchProcessModal.toast.noSelectedPlayer"),
        status: "warning",
      });
      handleCloseModalWithCancel();
      return;
    }
    if (activeStep >= launchProcessSteps.length) {
      // Final launching state, we don't use handleCloseModalWithCancel (it includes cancel logic)
      setErrorPaused(false);
      props.onClose();
      return;
    }
    const currentStep = launchProcessSteps[activeStep];

    if (previousStep.current !== activeStep) {
      previousStep.current = activeStep;
      currentStep.function().then((response) => {
        if (response.status === "success") {
          if (currentStep.isOK(response.data)) {
            setActiveStep(activeStep + 1);
          } else {
            currentStep.onResCallback(response.data);
          }
        } else {
          setErrorPaused(true);
          setErrorDesc(response.details);
          currentStep.onErrCallback(response);
          console.error(response.details);
        }
      });
    }
  }, [
    activeStep,
    setActiveStep,
    launchProcessSteps,
    handleCloseModalWithCancel,
    props,
    selectedPlayer,
    t,
    toast,
  ]);

  return (
    <Modal
      size="sm"
      closeOnEsc={false}
      closeOnOverlayClick={false}
      {...props}
      onClose={handleCloseModalWithCancel}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {t("LaunchProcessModal.header.title", {
            name: launchingInstance?.name,
          })}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody minH="12rem">
          <Stepper
            index={activeStep}
            orientation="vertical"
            h="12rem"
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
                <Box flexShrink="0">
                  <StepTitle>
                    <HStack>
                      <Text>{t(`LaunchProcessModal.step.${step.label}`)}</Text>
                      {index === activeStep && !errorPaused && (
                        <BeatLoader size={12} color="gray" />
                      )}
                    </HStack>
                  </StepTitle>
                  {errorPaused && errorDesc && index === activeStep && (
                    <StepDescription color="red.600">
                      {errorDesc}
                    </StepDescription>
                  )}
                </Box>
                <StepSeparator />
              </Step>
            ))}
          </Stepper>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={handleCloseModalWithCancel}>
            {t("General.cancel")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default LaunchProcessModal;

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
  useDisclosure,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import SelectInstanceModal from "@/components/modals/select-instance-modal";
import SelectPlayerModal from "@/components/modals/select-player-modal";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { LaunchServiceError } from "@/enums/service-error";
import { Player } from "@/models/account";
import { InstanceSummary } from "@/models/instance/misc";
import { ResponseError } from "@/models/response";
import { AccountService } from "@/services/account";
import { LaunchService } from "@/services/launch";

// This modal will use shared-modal-context
interface LaunchProcessModalProps extends Omit<ModalProps, "children"> {
  instanceId?: string;
  playerId?: string;
  quickPlaySingleplayer?: string;
  quickPlayMultiplayer?: string;
}

const LaunchProcessModal: React.FC<LaunchProcessModalProps> = ({
  instanceId,
  playerId,
  quickPlaySingleplayer,
  quickPlayMultiplayer,
  ...props
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { selectedPlayer, selectedInstance, getPlayerList, getInstanceList } =
    useGlobalData();
  const { openSharedModal, openGenericConfirmDialog, closeSharedModal } =
    useSharedModals();

  const [pickedInstance, setPickedInstance] = useState<InstanceSummary>();
  const [pickedPlayer, setPickedPlayer] = useState<Player>();
  const [errorPaused, setErrorPaused] = useState<boolean>(false);
  const [errorDesc, setErrorDesc] = useState<string>("");
  const [activeStep, setActiveStep] = useState<number>(-1);

  const previousStep = useRef<number>(-1);
  const candidatePlayers = getPlayerList();
  const candidateInstances = getInstanceList();
  const shouldPickInstance = instanceId?.toLowerCase() === "tbd";
  const requestedInstance = useMemo(
    () =>
      !candidateInstances || !instanceId || shouldPickInstance
        ? undefined
        : candidateInstances.find((instance) => instance.id === instanceId),
    [candidateInstances, instanceId, shouldPickInstance]
  );

  const shouldPickPlayer = playerId?.toLowerCase() === "tbd";
  const requestedPlayer = useMemo(
    () =>
      !candidatePlayers || !playerId || shouldPickPlayer
        ? undefined
        : candidatePlayers.find((player) => player.id === playerId),
    [candidatePlayers, playerId, shouldPickPlayer]
  );

  // Prefer the instance and player chosen in this launch flow before falling back to global selection.
  const effectiveInstance =
    pickedInstance ||
    requestedInstance ||
    (!instanceId ? selectedInstance : undefined);
  const effectiveSelectedPlayer =
    pickedPlayer || requestedPlayer || (!playerId ? selectedPlayer : undefined);

  const {
    isOpen: isSelectPlayerModalOpen,
    onOpen: onSelectPlayerModalOpen,
    onClose: onSelectPlayerModalClose,
  } = useDisclosure();
  const {
    isOpen: isSelectInstanceModalOpen,
    onOpen: onSelectInstanceModalOpen,
    onClose: onSelectInstanceModalClose,
  } = useDisclosure();

  // Reset the local instance override when a new instance request arrives.
  useEffect(() => {
    setPickedInstance(undefined);
  }, [instanceId]);

  // Reset the local player override when a new player request arrives.
  useEffect(() => {
    setPickedPlayer(undefined);
  }, [playerId]);

  const handleCloseModalWithCancel = useCallback(() => {
    LaunchService.cancelLaunchProcess();
    setErrorPaused(false);
    onSelectPlayerModalClose();
    onSelectInstanceModalClose();
    props.onClose();
  }, [onSelectInstanceModalClose, onSelectPlayerModalClose, props]);

  const handleSelectPlayer = useCallback(
    (player: Player) => {
      setPickedPlayer(player);
      onSelectPlayerModalClose();
    },
    [onSelectPlayerModalClose]
  );

  const handleSelectInstance = useCallback(
    (instance: InstanceSummary) => {
      setPickedInstance(instance);
      if (!shouldPickInstance || !selectedInstance) {
        update("states.shared.selectedInstanceId", instance.id);
      }
      onSelectInstanceModalClose();
    },
    [onSelectInstanceModalClose, selectedInstance, shouldPickInstance, update]
  );

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
        function: () =>
          LaunchService.selectSuitableJRE(effectiveInstance?.id || ""),
        isOK: (data: any) => true,
        onResCallback: (data: any) => {},
        onErrCallback: (error: ResponseError) => {
          if (error.raw_error === LaunchServiceError.NoSuitableJava) {
            openGenericConfirmDialog({
              title: t("NoSuitableJavaDialog.title"),
              body: t("NoSuitableJavaDialog.body"),
              onOKCallback: () => {
                router.push("/settings/java");
                closeSharedModal("launch");
              },
            });
          }
        },
      },
      {
        label: "validateGameFiles",
        function: () => LaunchService.validateGameFiles(),
        isOK: (data: any) => true,
        onResCallback: (data: any) => {}, // TODO
        onErrCallback: (error: ResponseError) => {
          toast({
            title: error.message,
            description: error.details,
            status: "error",
          });
          if (error.raw_error === LaunchServiceError.GameFilesIncomplete) {
            handleCloseModalWithCancel();
            router.push("/downloads");
          }
        },
      },
      {
        label: "validateSelectedPlayer",
        function: () => LaunchService.validateSelectedPlayer(),
        isOK: (data: boolean) => data,
        onResCallback: (data: boolean) => {
          const reValidate = () =>
            LaunchService.validateSelectedPlayer().then((response) => {
              if (response.status === "success") {
                setActiveStep(activeStep + 1);
              } else {
                setErrorPaused(true);
                setErrorDesc(response.details);
              }
            });
          AccountService.refreshPlayer(effectiveSelectedPlayer?.id || "").then(
            (response) => {
              if (response.status !== "success") {
                openSharedModal("relogin", {
                  player: effectiveSelectedPlayer,
                  onSuccess: () => {
                    reValidate();
                  },
                  onError: () => {
                    setErrorPaused(true);
                    setErrorDesc(response.details);
                    logger.error(response.details);
                  },
                });
              } else {
                reValidate();
              }
            }
          );
        },
        onErrCallback: (error: ResponseError) => {},
      },
      {
        label: "launchGame",
        function: () =>
          LaunchService.launchGame(quickPlaySingleplayer, quickPlayMultiplayer),
        isOK: (data: any) => true,
        onResCallback: (data: any) => {},
        onErrCallback: (error: ResponseError) => {},
      },
    ],
    [
      activeStep,
      closeSharedModal,
      effectiveInstance,
      effectiveSelectedPlayer,
      handleCloseModalWithCancel,
      openGenericConfirmDialog,
      openSharedModal,
      quickPlaySingleplayer,
      quickPlayMultiplayer,
      router,
      t,
      toast,
    ]
  );

  // Gate the launch steps on required selections, opening local pickers when possible.
  useEffect(() => {
    if (candidateInstances === undefined) return;
    if (!candidateInstances.length) {
      toast({
        title: t("LaunchProcessModal.toast.noSelectedInstance"),
        status: "warning",
      });
      handleCloseModalWithCancel();
      return;
    }
    if (!effectiveInstance) {
      onSelectInstanceModalOpen();
      return;
    }

    if (candidatePlayers === undefined) return;
    if (!candidatePlayers.length) {
      toast({
        title: t("LaunchProcessModal.toast.noSelectedPlayer"),
        status: "warning",
      });
      handleCloseModalWithCancel();
      return;
    }
    if (!effectiveSelectedPlayer) {
      onSelectPlayerModalOpen();
      return;
    }
    // Update selectedPlayerId because validateSelectedPlayer will read it from backend config state later.
    if (selectedPlayer?.id !== effectiveSelectedPlayer.id) {
      update("states.shared.selectedPlayerId", effectiveSelectedPlayer.id);
      return;
    }

    if (activeStep < 0) {
      setActiveStep(0);
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
          logger.error(response.details);
        }
      });
    }
  }, [
    activeStep,
    candidateInstances,
    candidatePlayers,
    effectiveInstance,
    effectiveSelectedPlayer,
    onSelectInstanceModalOpen,
    onSelectPlayerModalOpen,
    launchProcessSteps,
    handleCloseModalWithCancel,
    props,
    requestedInstance,
    requestedPlayer,
    selectedPlayer,
    update,
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
            name: effectiveInstance?.name,
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
      <SelectPlayerModal
        candidatePlayers={candidatePlayers || []}
        onPlayerSelected={handleSelectPlayer}
        modalTitle={t("SelectPlayerModal.header.titleForLaunch")}
        showDesc
        isOpen={isSelectPlayerModalOpen}
        onClose={handleCloseModalWithCancel}
      />
      <SelectInstanceModal
        candidateInstances={candidateInstances || []}
        selectedInstance={effectiveInstance}
        onInstanceSelected={handleSelectInstance}
        modalTitle={t("SelectInstanceModal.header.titleForLaunch")}
        isOpen={isSelectInstanceModalOpen}
        onClose={handleCloseModalWithCancel}
      />
    </Modal>
  );
};

export default LaunchProcessModal;

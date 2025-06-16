import {
  Button,
  Fade,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  PinInput,
  PinInputField,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCopy } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { ConfigService } from "@/services/config";

interface SyncConfigModalProps extends Omit<ModalProps, "children"> {}

export const SyncConfigExportModal: React.FC<SyncConfigModalProps> = ({
  ...modalProps
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [token, setToken] = useState<string>();
  const [countdown, setCountdown] = useState<number>(60);
  const [fadeFlag, setFadeFlag] = useState<boolean>(true);

  const handleExportLauncherConfig = useCallback(async () => {
    setFadeFlag(false);
    const response = await ConfigService.exportLauncherConfig();

    if (response.status === "success") {
      setToken(response.data);
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
    }
    setFadeFlag(true);
  }, [toast]);

  useEffect(() => {
    if (modalProps.isOpen && token === undefined) {
      handleExportLauncherConfig();
    }
  }, [handleExportLauncherConfig, modalProps.isOpen, token]);

  useEffect(() => {
    if (!modalProps.isOpen || token === undefined) return;

    const interval = setInterval(() => {
      setCountdown((prevCountdown) => {
        if (prevCountdown <= 1) {
          handleExportLauncherConfig();
          return 60;
        }
        return prevCountdown - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [handleExportLauncherConfig, modalProps.isOpen, token]);

  return (
    <Modal size={{ base: "md", lg: "lg", xl: "xl" }} {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("SyncConfigExportModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            <FormLabel>{t("SyncConfigExportModal.label.token")}</FormLabel>
            <HStack spacing={2} alignItems="center">
              <Fade in={fadeFlag}>
                <Heading size="lg" color={`${primaryColor}.500`}>
                  {token}
                </Heading>
              </Fade>
              <IconButton
                aria-label="copy"
                color={"gray.500"}
                variant="ghost"
                minW={5}
                maxH={5}
                icon={<LuCopy />}
                onClick={() => {
                  if (token) {
                    navigator.clipboard.writeText(token);
                    toast({
                      title: t("General.copy.toast.success"),
                      status: "success",
                    });
                  } else {
                    toast({
                      title: t("General.copy.toast.error"),
                      status: "error",
                    });
                  }
                }}
              />
              <Text size="sm" className="secondary-text">
                {t("SyncConfigExportModal.countdown", { seconds: countdown })}
              </Text>
            </HStack>
            <FormHelperText>{t("SyncConfigExportModal.helper")}</FormHelperText>
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme={primaryColor} onClick={modalProps.onClose}>
            {t("General.close")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export const SyncConfigImportModal: React.FC<SyncConfigModalProps> = ({
  ...modalProps
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config, setConfig } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fields = new Array(6).fill(null);

  const handleImportLauncherConfig = useCallback(async () => {
    setIsLoading(true);
    const response = await ConfigService.importLauncherConfig(token);
    if (response.status === "success") {
      setConfig(response.data);
      toast({
        title: response.message,
        status: "success",
      });
      setToken("");
      modalProps.onClose();
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
    }
    setIsLoading(false);
  }, [modalProps, setConfig, toast, token]);

  return (
    <Modal size={{ base: "md", lg: "lg", xl: "xl" }} {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("SyncConfigImportModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            <FormLabel>{t("SyncConfigImportModal.label.token")}</FormLabel>
            <HStack>
              <PinInput
                value={token}
                onChange={(newToken) => setToken(newToken)}
                placeholder=""
                focusBorderColor={`${primaryColor}.500`}
              >
                {fields.map((_, index) => (
                  <PinInputField key={index} autoFocus={index === 0} />
                ))}
              </PinInput>
            </HStack>
            <FormHelperText>{t("SyncConfigImportModal.helper")}</FormHelperText>
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={modalProps.onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            isLoading={isLoading}
            colorScheme={primaryColor}
            onClick={handleImportLauncherConfig}
            isDisabled={!/^[0-9]{6}$/.test(token)}
          >
            {t("General.finish")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

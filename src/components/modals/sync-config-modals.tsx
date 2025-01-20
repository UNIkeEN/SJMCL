import {
  Button,
  Fade,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
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
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";

interface SyncConfigModalProps extends Omit<ModalProps, "children"> {}

export const SyncConfigExportModal: React.FC<SyncConfigModalProps> = ({
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [token, setToken] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(60);
  const [fadeFlag, setFadeFlag] = useState<boolean>(true);

  // only for mock
  const generateToken = () => {
    return Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
  };

  useEffect(() => {
    setToken(generateToken());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prevCountdown) => {
        if (prevCountdown <= 1) {
          setFadeFlag(false);
          setTimeout(() => {
            setToken(generateToken());
            setFadeFlag(true);
          }, 300);
          return 60;
        }
        return prevCountdown - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Modal size={{ base: "md", lg: "lg", xl: "xl" }} {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("SyncConfigExportModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            <FormLabel>{t("SyncConfigExportModal.label.token")}</FormLabel>
            <HStack spacing={4} alignItems="center">
              <Fade in={fadeFlag}>
                <Heading size="lg" color={`${primaryColor}.500`}>
                  {token}
                </Heading>
              </Fade>
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
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const fields = new Array(6).fill(null);

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
              <PinInput placeholder="" focusBorderColor={`${primaryColor}.500`}>
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
          <Button colorScheme={primaryColor} onClick={modalProps.onClose}>
            {t("General.finish")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

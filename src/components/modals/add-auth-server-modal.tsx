import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useToast } from "@/contexts/toast";
import { AccountService } from "@/services/account";

interface AddAuthServerModalProps extends Omit<ModalProps, "children"> {
  presetUrl?: string;
}

const AddAuthServerModal: React.FC<AddAuthServerModalProps> = ({
  presetUrl = "",
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { getAuthServerList } = useGlobalData();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { isOpen, onClose } = modalProps;
  const initialRef = useRef(null);
  const hasAutoPresetRef = useRef(false);

  const [serverUrl, setServerUrl] = useState<string>("");
  const [serverName, setServerName] = useState<string>("");
  const [isNextStep, setIsNextStep] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [isServerUrlTouched, setIsServerUrlTouched] = useState(false);
  const isServerUrlInvalid = isServerUrlTouched && !serverUrl;

  useEffect(() => {
    if (isOpen) {
      hasAutoPresetRef.current = false;
      setIsNextStep(false);
      setServerUrl(presetUrl);
      setIsServerUrlTouched(false);
    }
  }, [isOpen, presetUrl]);

  const handleNextStep = useCallback(() => {
    setIsLoading(true);
    // test the server url in backend & get the server name (without saving)
    AccountService.fetchAuthServer(serverUrl)
      .then((response) => {
        if (response.status === "success") {
          setServerName(response.data.name);
          setServerUrl(response.data.authUrl);
          setIsNextStep(true);
        } else {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [serverUrl, toast]);

  useEffect(() => {
    if (
      isOpen &&
      presetUrl &&
      serverUrl === presetUrl &&
      !hasAutoPresetRef.current
    ) {
      handleNextStep();
      hasAutoPresetRef.current = true;
    }
  }, [isOpen, presetUrl, serverUrl, handleNextStep]);

  const handleFinish = () => {
    setIsLoading(true);
    // save the server info to the storage
    AccountService.addAuthServer(serverUrl)
      .then((response) => {
        if (response.status === "success") {
          getAuthServerList(true);
          toast({
            title: response.message,
            status: "success",
          });
          onClose?.();
        } else {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <Modal
      size={{ base: "md", lg: "lg", xl: "xl" }}
      initialFocusRef={initialRef}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("AddAuthServerModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {!config.basicInfo.allowFullLoginFeature && (
            <Alert status="error" borderRadius="md" mb="3">
              <AlertIcon />
              <VStack spacing={0} align="start">
                <AlertTitle>{t("General.alert.noFullLogin.title")}</AlertTitle>
                <AlertDescription>
                  {t("General.alert.noFullLogin.description")}
                </AlertDescription>
              </VStack>
            </Alert>
          )}
          {!isNextStep ? (
            <FormControl
              isDisabled={!config.basicInfo.allowFullLoginFeature}
              isInvalid={isServerUrlInvalid}
              isRequired
            >
              <FormLabel htmlFor="serverUrl">
                {t("AddAuthServerModal.page1.serverUrl")}
              </FormLabel>
              <Input
                id="serverUrl"
                type="url"
                placeholder={t("AddAuthServerModal.placeholder.inputServerUrl")}
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                onBlur={() => setIsServerUrlTouched(true)}
                ref={initialRef}
                focusBorderColor={`${primaryColor}.500`}
              />
              {isServerUrlInvalid && (
                <FormErrorMessage>
                  {t("AddAuthServerModal.page1.serverUrlRequired")}
                </FormErrorMessage>
              )}
            </FormControl>
          ) : (
            <VStack spacing={3.5} align="flex-start">
              <HStack spacing={2}>
                <Text fontWeight={500}>
                  {t("AddAuthServerModal.page2.name")}
                </Text>
                <Text>{serverName}</Text>
              </HStack>
              <HStack spacing={2}>
                <Text fontWeight={500}>
                  {t("AddAuthServerModal.page2.serverUrl")}
                </Text>
                <Text>{serverUrl}</Text>
              </HStack>
            </VStack>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("General.cancel")}
          </Button>
          {isNextStep ? (
            <>
              <Button variant="ghost" onClick={() => setIsNextStep(false)}>
                {t("General.previous")}
              </Button>
              <Button
                disabled={!config.basicInfo.allowFullLoginFeature}
                colorScheme={primaryColor}
                onClick={handleFinish}
                isLoading={isLoading}
              >
                {t("General.finish")}
              </Button>
            </>
          ) : (
            <Button
              colorScheme={primaryColor}
              onClick={handleNextStep}
              isLoading={isLoading}
              isDisabled={!serverUrl}
            >
              {t("General.next")}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddAuthServerModal;

import {
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
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { useData, useDataDispatch } from "@/contexts/data";
import { useToast } from "@/contexts/toast";
import { AuthServerError, errorToLocaleKey } from "@/models/account";
import {
  addAuthServer,
  getAuthServerInfo,
  getAuthServerList,
} from "@/services/account";

interface AddAuthServerModalProps extends Omit<ModalProps, "children"> {}

const AddAuthServerModal: React.FC<AddAuthServerModalProps> = ({
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { authServerList } = useData();
  const { setAuthServerList } = useDataDispatch();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { isOpen, onClose } = modalProps;

  const [serverUrl, setServerUrl] = useState<string>("");
  const [serverName, setServerName] = useState<string>("");
  const [isNextStep, setIsNextStep] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [isServerUrlTouched, setIsServerUrlTouched] = useState(false);
  const isServerUrlInvalid = isServerUrlTouched && !serverUrl;

  useEffect(() => {
    if (isOpen) {
      setIsNextStep(false);
      setServerUrl("");
      setIsServerUrlTouched(false);
    }
  }, [isOpen]);

  const handleNextStep = () => {
    (async () => {
      try {
        setIsLoading(true);
        // test the server url in backend & get the server name (without saving)
        const newServer = await getAuthServerInfo(serverUrl);
        setServerName(newServer.name);
        setServerUrl(newServer.authUrl);
        setIsNextStep(true);
      } catch (error) {
        toast({
          title: t("Services.account.getAuthServerInfo.error.title"),
          description: t(
            `Services.account.getAuthServerInfo.error.description.${errorToLocaleKey(error)}`
          ),
          status: "error",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const handleFinish = () => {
    (async () => {
      try {
        setIsLoading(true);
        // save the server info to the storage
        await addAuthServer(serverUrl);
        setAuthServerList(await getAuthServerList());
        toast({
          title: t("Services.account.addAuthServer.success"),
          status: "success",
        });
        onClose?.();
      } catch (error) {
        toast({
          title: t("Services.account.addAuthServer.error.title"),
          description: t(
            `Services.account.addAuthServer.error.description.${errorToLocaleKey(error)}`
          ),
          status: "error",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  };

  return (
    <Modal size={{ base: "md", lg: "lg", xl: "xl" }} {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("AddAuthServerModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {!isNextStep ? (
            <FormControl isInvalid={isServerUrlInvalid}>
              <FormLabel htmlFor="serverUrl">
                {t("AddAuthServerModal.page1.serverUrl")}{" "}
                <Text as="span" color="red.500">
                  *
                </Text>
              </FormLabel>
              <Input
                id="serverUrl"
                type="url"
                placeholder={t("AddAuthServerModal.placeholder.inputServerUrl")}
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                onBlur={() => setIsServerUrlTouched(true)}
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

import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  VStack,
} from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { InstanceService } from "@/services/instance";

// 改为导入 InstanceService

interface AddGameServerModalProps extends Omit<ModalProps, "children"> {
  presetUrl?: string;
  instanceId: string; // 添加实例ID参数
  onSuccess?: () => void; // 添加成功回调
}

const AddGameServerModal: React.FC<AddGameServerModalProps> = ({
  presetUrl = "",
  instanceId,
  onSuccess,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { isOpen, onClose } = modalProps;
  const initialRef = useRef(null);
  const hasAutoPresetRef = useRef(false);

  const [serverUrl, setServerUrl] = useState<string>("");
  const [serverName, setServerName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [isServerUrlTouched, setIsServerUrlTouched] = useState(false);
  const isServerUrlInvalid = isServerUrlTouched && !serverUrl;

  useEffect(() => {
    if (isOpen) {
      hasAutoPresetRef.current = false;
      setServerUrl(presetUrl);
      setServerName("");
      setIsServerUrlTouched(false);
    }
  }, [isOpen, presetUrl]);
  const handleFinish = useCallback(() => {
    setIsLoading(true);
    // 直接添加游戏服务器，不进行预查询（如果需要查询可以在后端进行）
    InstanceService.addGameServer(instanceId, serverUrl, serverName)
      .then((response) => {
        if (response.status === "success") {
          toast({
            title: t("AddGameServerModal.success.title"),
            status: "success",
          });
          if (onSuccess) {
            onSuccess();
          }
          onClose?.();
        } else {
          toast({
            title: t("AddGameServerModal.error.title"),
            description: response.details,
            status: "error",
          });
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [instanceId, serverUrl, onSuccess, serverName, toast, t, onClose]);

  useEffect(() => {
    if (
      isOpen &&
      presetUrl &&
      serverUrl === presetUrl &&
      !hasAutoPresetRef.current
    ) {
      // 自动填充时，如果没有提供服务器名称，则尝试从URL中提取
      if (!serverName) {
        const urlObj = new URL(presetUrl);
        const extractedName = urlObj.hostname || presetUrl;
        setServerName(extractedName);
      }
      hasAutoPresetRef.current = true;
    }
  }, [isOpen, presetUrl, serverUrl, serverName]);

  return (
    <Modal
      size={{ base: "md", lg: "lg", xl: "xl" }}
      initialFocusRef={initialRef}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("AddGameServerModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl isInvalid={isServerUrlInvalid} isRequired>
              <FormLabel htmlFor="serverUrl">
                {t("AddGameServerModal.serverUrl")}
              </FormLabel>
              <Input
                id="serverUrl"
                type="url"
                placeholder={t("AddGameServerModal.placeholder.inputServerUrl")}
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                onBlur={() => setIsServerUrlTouched(true)}
                ref={initialRef}
                focusBorderColor={`${primaryColor}.500`}
              />
              {isServerUrlInvalid && (
                <FormErrorMessage>
                  {t("AddGameServerModal.serverUrlRequired")}
                </FormErrorMessage>
              )}
            </FormControl>

            <FormControl>
              <FormLabel htmlFor="serverName">
                {t("AddGameServerModal.serverName")}
              </FormLabel>
              <Input
                id="serverName"
                type="text"
                placeholder={t(
                  "AddGameServerModal.placeholder.inputServerName"
                )}
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                focusBorderColor={`${primaryColor}.500`}
              />
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            colorScheme={primaryColor}
            onClick={handleFinish}
            isLoading={isLoading}
            isDisabled={!serverUrl}
            ml={3}
          >
            {t("General.finish")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddGameServerModal;

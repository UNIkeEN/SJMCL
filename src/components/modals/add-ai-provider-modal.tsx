import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
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
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";

/** 本地存储 key */
export const AI_PROVIDER_STORAGE_KEY = "ai-provider";

/** 简单持久化工具 */
export function loadAIProvider() {
  try {
    const raw = localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && obj.baseURL && obj.apiKey && obj.model ? obj : null;
  } catch {
    return null;
  }
}
export function saveAIProvider(provider: {
  baseURL: string;
  apiKey: string;
  model: string;
}) {
  localStorage.setItem(AI_PROVIDER_STORAGE_KEY, JSON.stringify(provider));
}

interface AddAIProviderModalProps extends Omit<ModalProps, "children"> {}

const AddAIProviderModal: React.FC<AddAIProviderModalProps> = (modalProps) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const { isOpen, onClose } = modalProps;
  const initialRef = useRef<HTMLInputElement | null>(null);

  const [baseURL, setBaseURL] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [touched, setTouched] = useState({
    baseURL: false,
    apiKey: false,
    model: false,
  });

  useEffect(() => {
    if (isOpen) {
      const exist = loadAIProvider();
      setBaseURL(exist?.baseURL ?? "");
      setApiKey(exist?.apiKey ?? "");
      setModel(exist?.model ?? "");
      setTouched({ baseURL: false, apiKey: false, model: false });
    }
  }, [isOpen]);

  const baseURLInvalid = touched.baseURL && !baseURL;
  const apiKeyInvalid = touched.apiKey && !apiKey;
  const modelInvalid = touched.model && !model;

  const handleSave = () => {
    setIsSaving(true);
    try {
      // 简单校验
      if (!baseURL || !apiKey || !model) {
        setTouched({ baseURL: true, apiKey: true, model: true });
        setIsSaving(false);
        return;
      }
      // 统一去掉尾部斜杠
      const normalized = baseURL.replace(/\/+$/, "");
      saveAIProvider({ baseURL: normalized, apiKey, model });
      toast({ title: t("已保存 AI 供应商配置"), status: "success" });
      onClose?.();
    } catch (e: any) {
      toast({
        title: t("保存失败"),
        description: String(e?.message ?? e),
        status: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      size={{ base: "md", lg: "lg" }}
      initialFocusRef={initialRef}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>添加 AI 供应商</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {/* 可选：根据配置开关做限制提示（与 AddAuthServerModal 一致的提示风格） */}
          {!config.basicInfo.allowFullLoginFeature && (
            <Alert status="warning" borderRadius="md" mb="3">
              <AlertIcon />
              <VStack spacing={0} align="start">
                <AlertTitle>注意</AlertTitle>
                <AlertDescription>
                  当前环境可能对高级功能有限制，但不影响保存本地 AI 供应商配置。
                </AlertDescription>
              </VStack>
            </Alert>
          )}

          <VStack spacing={4} align="stretch">
            <FormControl isRequired isInvalid={baseURLInvalid}>
              <FormLabel htmlFor="ai-baseurl">Base URL</FormLabel>
              <Input
                id="ai-baseurl"
                placeholder="例如：https://api.openai.com"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                onBlur={() => setTouched((s) => ({ ...s, baseURL: true }))}
                ref={initialRef}
                focusBorderColor={`${primaryColor}.500`}
              />
              {baseURLInvalid && (
                <FormErrorMessage>Base URL 不能为空</FormErrorMessage>
              )}
            </FormControl>

            <FormControl isRequired isInvalid={apiKeyInvalid}>
              <FormLabel htmlFor="ai-apikey">API Key</FormLabel>
              <Input
                id="ai-apikey"
                type="password"
                placeholder="填入你的 API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={() => setTouched((s) => ({ ...s, apiKey: true }))}
                focusBorderColor={`${primaryColor}.500`}
              />
              {apiKeyInvalid && (
                <FormErrorMessage>API Key 不能为空</FormErrorMessage>
              )}
            </FormControl>

            <FormControl isRequired isInvalid={modelInvalid}>
              <FormLabel htmlFor="ai-model">Model</FormLabel>
              <Input
                id="ai-model"
                placeholder="例如：gpt-4o-mini / deepseek-chat / qwen2.5-7b-instruct"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                onBlur={() => setTouched((s) => ({ ...s, model: true }))}
                focusBorderColor={`${primaryColor}.500`}
              />
              {modelInvalid && (
                <FormErrorMessage>Model 不能为空</FormErrorMessage>
              )}
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            colorScheme={primaryColor}
            onClick={handleSave}
            isLoading={isSaving}
          >
            保存
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddAIProviderModal;

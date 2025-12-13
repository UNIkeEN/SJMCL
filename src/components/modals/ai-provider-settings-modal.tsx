import {
  Button,
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
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { IntelligenceService } from "@/services/intelligence";

// TODO: remove this modal, migrate to settings page

interface AiProviderSettingsModalProps extends Omit<ModalProps, "children"> {}

const AiProviderSettingsModal: React.FC<AiProviderSettingsModalProps> = (
  modalProps
) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config, update } = useLauncherConfig();
  const intelligenceCfg = config.intelligence;
  const primaryColor = config.appearance.theme.primaryColor;

  const { onClose } = modalProps;
  const [baseUrl, setBaseURL] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setBaseURL(intelligenceCfg.model.baseUrl);
    setApiKey(intelligenceCfg.model.apiKey);
    setModel(intelligenceCfg.model.model);
  }, [
    intelligenceCfg.model.apiKey,
    intelligenceCfg.model.baseUrl,
    intelligenceCfg.model.model,
  ]);

  const handleSave = async () => {
    setIsSaving(true);
    // check service availability
    let response = await IntelligenceService.checkLLMServiceAvailability(
      baseUrl,
      apiKey,
      model
    );
    setIsSaving(false);
    if (response.status === "success") {
      update("intelligence", {
        enabled: true,
        model: {
          baseUrl,
          apiKey,
          model,
        },
      });
      toast({
        title: response.message,
        status: "success",
      });
      onClose();
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
    }
  };

  const aiProviderSettingsGroups: OptionItemGroupProps[] = [
    {
      items: [
        {
          title: t("AiProviderSettingsModal.baseUrl"),
          children: (
            <Input
              value={baseUrl}
              onChange={(e) => setBaseURL(e.target.value)}
              flex={1}
            />
          ),
        },
        {
          title: t("AiProviderSettingsModal.apiKey"),
          children: (
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              flex={1}
            />
          ),
        },
        {
          title: t("AiProviderSettingsModal.model"),
          children: (
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              flex={1}
            />
          ),
        },
      ],
    },
  ];

  return (
    <Modal size={{ base: "md", lg: "lg" }} {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("AiProviderSettingsModal.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {aiProviderSettingsGroups.map((group, index) => (
              <OptionItemGroup
                title={group.title}
                items={group.items}
                key={index}
                w="100%"
              />
            ))}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            colorScheme={primaryColor}
            onClick={handleSave}
            isLoading={isSaving}
          >
            {t("General.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AiProviderSettingsModal;

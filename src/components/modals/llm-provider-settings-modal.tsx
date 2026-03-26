import {
  Button,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Tag,
  TagLabel,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuChevronDown, LuChevronUp, LuX } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { MenuSelector } from "@/components/common/menu-selector";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { LLMProviderConfig, LLMProviderType } from "@/models/config";
import { IntelligenceService } from "@/services/intelligence";

interface LLMProviderSettingsModalProps extends Omit<ModalProps, "children"> {
  provider: LLMProviderConfig;
  onSave: (provider: LLMProviderConfig) => void;
  onCancel: () => void;
}

const LLMProviderSettingsModal: React.FC<LLMProviderSettingsModalProps> = ({
  provider,
  onSave,
  onCancel,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const primaryColor = useLauncherConfig().config.appearance.theme.primaryColor;
  const unifiedFieldRadius = "md";
  const [draft, setDraft] = useState<LLMProviderConfig>({ ...provider });
  const [isApiKeyEditing, setIsApiKeyEditing] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [modelAvailability, setModelAvailability] = useState<boolean | null>(
    null
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maskedApiKey = useMemo(() => {
    if (!draft.apiKey) return "";
    return "*".repeat(Math.max(2, draft.apiKey.length));
  }, [draft.apiKey]);

  const showBaseUrl = draft.providerType === "openAiCompatible";

  const endpointHint = useMemo(() => {
    switch (draft.providerType) {
      case "openAiCompatible":
        return `${draft.baseUrl}/v1/chat/completions`;
      case "anthropic":
        return "https://api.anthropic.com/v1/messages";
      case "gemini":
        return "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";
    }
  }, [draft.providerType, draft.baseUrl]);

  const effectiveBaseUrl = useMemo(() => {
    if (draft.providerType === "openAiCompatible") return draft.baseUrl.trim();
    return "";
  }, [draft.providerType, draft.baseUrl]);

  const trimmedApiKey = useMemo(() => draft.apiKey.trim(), [draft.apiKey]);

  const canCheck = useMemo(() => {
    if (draft.providerType === "openAiCompatible") {
      return !!effectiveBaseUrl && !!trimmedApiKey;
    }
    return !!trimmedApiKey;
  }, [draft.providerType, effectiveBaseUrl, trimmedApiKey]);

  useEffect(() => {
    setDraft({ ...provider });
    setAvailableModels([]);
    setModelAvailability(null);
  }, [provider]);

  const handleCheckAvailability = useCallback(
    (pt: string, b: string, k: string) => {
      setIsChecking(true);
      setModelAvailability(null);
      IntelligenceService.retrieveLLMModels(pt, b, k)
        .then((resp) => {
          if (resp.status === "success") {
            setModelAvailability(true);
            setAvailableModels(resp.data);
            setDraft((prev) => {
              const nextModel = resp.data.includes(prev.model)
                ? prev.model
                : (resp.data[0] ?? "");
              return { ...prev, model: nextModel };
            });
          } else {
            setModelAvailability(false);
            setAvailableModels([]);
          }
          setIsChecking(false);
        })
        .catch(() => {
          setModelAvailability(false);
          setIsChecking(false);
        });
    },
    []
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!canCheck) {
      setModelAvailability(null);
      setIsChecking(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      handleCheckAvailability(
        draft.providerType,
        effectiveBaseUrl,
        trimmedApiKey
      );
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    draft.providerType,
    effectiveBaseUrl,
    trimmedApiKey,
    canCheck,
    handleCheckAvailability,
  ]);

  const update = <K extends keyof LLMProviderConfig>(
    key: K,
    value: LLMProviderConfig[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const updateParam = (key: string, value: number) => {
    setDraft((prev) => ({
      ...prev,
      parameters: { ...prev.parameters, [key]: value },
    }));
  };

  const formItems: OptionItemGroupProps[] = [
    {
      title: t("LLMProviderSettingsModal.content.model.title"),
      items: [
        // Provider name
        {
          title: t(
            "LLMProviderSettingsModal.content.model.settings.name.title"
          ),
          children: (
            <Input
              size="xs"
              w="60%"
              borderRadius={unifiedFieldRadius}
              focusBorderColor={`${primaryColor}.500`}
              placeholder={t(
                "LLMProviderSettingsModal.content.model.settings.name.placeholder"
              )}
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
            />
          ),
        },
        // Provider type
        {
          title: t(
            "LLMProviderSettingsModal.content.model.settings.provider.title"
          ),
          children: (
            <MenuSelector
              buttonProps={{ w: "60%", borderRadius: unifiedFieldRadius }}
              placement="bottom-end"
              value={draft.providerType}
              onSelect={(value) => {
                update("providerType", value as LLMProviderType);
                setModelAvailability(null);
                setAvailableModels([]);
                update("model", "");
              }}
              options={Object.values(LLMProviderType).map((opt) => ({
                label: t(
                  `LLMProviderSettingsModal.content.model.settings.provider.options.${opt}`
                ),
                value: opt,
              }))}
            />
          ),
        },
        // Base URL (OpenAI only)
        ...(showBaseUrl
          ? [
              {
                title: t(
                  "LLMProviderSettingsModal.content.model.settings.baseUrl.title"
                ),
                children: (
                  <VStack w="60%" alignItems="start">
                    <Input
                      size="xs"
                      w="full"
                      borderRadius={unifiedFieldRadius}
                      focusBorderColor={`${primaryColor}.500`}
                      value={draft.baseUrl}
                      onChange={(e) => update("baseUrl", e.target.value)}
                    />
                    <Text fontSize="xs" className="secondary-text">
                      {t(
                        "LLMProviderSettingsModal.content.model.settings.baseUrl.fullUrl",
                        {
                          url: endpointHint,
                        }
                      )}
                    </Text>
                  </VStack>
                ),
              },
            ]
          : [
              {
                title: t(
                  "LLMProviderSettingsModal.content.model.settings.endpoint.title"
                ),
                children: (
                  <Text fontSize="xs" className="secondary-text">
                    {endpointHint}
                  </Text>
                ),
              },
            ]),
        // API Key
        {
          title: t(
            "LLMProviderSettingsModal.content.model.settings.apiKey.title"
          ),
          children: (
            <Input
              size="xs"
              w="60%"
              borderRadius={unifiedFieldRadius}
              focusBorderColor={`${primaryColor}.500`}
              value={isApiKeyEditing ? draft.apiKey : maskedApiKey}
              onChange={(e) => {
                if (isApiKeyEditing) update("apiKey", e.target.value);
              }}
              onFocus={() => setIsApiKeyEditing(true)}
              onBlur={() => setIsApiKeyEditing(false)}
            />
          ),
        },
        // Model selector
        {
          title: t(
            "LLMProviderSettingsModal.content.model.settings.model.title"
          ),
          children: (
            <MenuSelector
              buttonProps={{
                w: "60%",
                borderRadius: unifiedFieldRadius,
              }}
              menuListProps={{
                maxH: "200px",
                overflowY: "auto",
              }}
              placement="bottom-end"
              value={draft.model || null}
              onSelect={(value) => {
                if (typeof value === "string") {
                  update("model", value);
                }
              }}
              options={availableModels.map((m) => ({
                label: m,
                value: m,
              }))}
              disabled={!canCheck || isChecking || !modelAvailability}
              placeholder="--"
            />
          ),
        },
        // Availability check
        {
          title: t(
            "LLMProviderSettingsModal.content.model.settings.checkAvailability.title"
          ),
          children: (
            <HStack spacing={1}>
              {!canCheck || modelAvailability === null ? (
                <Text fontSize="xs-sm" className="secondary-text">
                  --
                </Text>
              ) : isChecking ? (
                <BeatLoader size={6} />
              ) : (
                <>
                  <CommonIconButton
                    icon="refresh"
                    h={18}
                    onClick={() =>
                      handleCheckAvailability(
                        draft.providerType,
                        effectiveBaseUrl,
                        trimmedApiKey
                      )
                    }
                  />
                  <Tag colorScheme={modelAvailability ? "green" : "red"}>
                    <HStack spacing={0.5}>
                      {modelAvailability ? (
                        <>
                          <LuCheck />
                          <TagLabel>
                            {t(
                              "LLMProviderSettingsModal.content.model.settings.checkAvailability.available"
                            )}
                          </TagLabel>
                        </>
                      ) : (
                        <>
                          <LuX />
                          <TagLabel>
                            {t(
                              "LLMProviderSettingsModal.content.model.settings.checkAvailability.unavailable"
                            )}
                          </TagLabel>
                        </>
                      )}
                    </HStack>
                  </Tag>
                </>
              )}
            </HStack>
          ),
        },
      ],
    },
    // Advanced Parameters
    {
      title: t("LLMProviderSettingsModal.content.parameters.title"),
      items: [
        {
          title: t(
            "LLMProviderSettingsModal.content.parameters.temperature.title"
          ),
          description: t(
            "LLMProviderSettingsModal.content.parameters.temperature.description"
          ),
          children: (
            <HStack spacing={4} w="40%">
              <Slider
                min={0}
                max={2}
                step={0.1}
                flex={1}
                colorScheme={primaryColor}
                value={draft.parameters.temperature}
                onChange={(v) => updateParam("temperature", v)}
              >
                <SliderTrack>
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb />
              </Slider>
              <NumberInput
                min={0}
                max={2}
                step={0.1}
                size="xs"
                maxW={20}
                value={draft.parameters.temperature}
                onChange={(_, v) => {
                  if (!isNaN(v)) updateParam("temperature", v);
                }}
              >
                <NumberInputField textAlign="right" />
                <NumberInputStepper>
                  <NumberIncrementStepper>
                    <LuChevronUp size={8} />
                  </NumberIncrementStepper>
                  <NumberDecrementStepper>
                    <LuChevronDown size={8} />
                  </NumberDecrementStepper>
                </NumberInputStepper>
              </NumberInput>
            </HStack>
          ),
        },
        {
          title: t(
            "LLMProviderSettingsModal.content.parameters.maxTokens.title"
          ),
          description: t(
            "LLMProviderSettingsModal.content.parameters.maxTokens.description"
          ),
          children: (
            <NumberInput
              w="40%"
              min={1}
              max={128000}
              size="xs"
              maxW={20}
              value={draft.parameters.maxTokens}
              onChange={(_, v) => {
                if (!isNaN(v)) updateParam("maxTokens", v);
              }}
            >
              <NumberInputField textAlign="right" />
              <NumberInputStepper>
                <NumberIncrementStepper>
                  <LuChevronUp size={8} />
                </NumberIncrementStepper>
                <NumberDecrementStepper>
                  <LuChevronDown size={8} />
                </NumberDecrementStepper>
              </NumberInputStepper>
            </NumberInput>
          ),
        },
        {
          title: t("LLMProviderSettingsModal.content.parameters.topP.title"),
          description: t(
            "LLMProviderSettingsModal.content.parameters.topP.description"
          ),
          children: (
            <HStack spacing={4} w="40%">
              <Slider
                min={0}
                max={1}
                step={0.05}
                flex={1}
                colorScheme={primaryColor}
                value={draft.parameters.topP}
                onChange={(v) => updateParam("topP", v)}
              >
                <SliderTrack>
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb />
              </Slider>
              <NumberInput
                min={0}
                max={1}
                step={0.05}
                size="xs"
                maxW={20}
                value={draft.parameters.topP}
                onChange={(_, v) => {
                  if (!isNaN(v)) updateParam("topP", v);
                }}
              >
                <NumberInputField textAlign="right" />
                <NumberInputStepper>
                  <NumberIncrementStepper>
                    <LuChevronUp size={8} />
                  </NumberIncrementStepper>
                  <NumberDecrementStepper>
                    <LuChevronDown size={8} />
                  </NumberDecrementStepper>
                </NumberInputStepper>
              </NumberInput>
            </HStack>
          ),
        },
        ...(draft.providerType === "openAiCompatible"
          ? [
              {
                title: t(
                  "LLMProviderSettingsModal.content.parameters.frequencyPenalty.title"
                ),
                description: t(
                  "LLMProviderSettingsModal.content.parameters.frequencyPenalty.description"
                ),
                children: (
                  <HStack spacing={4} w="40%">
                    <Slider
                      min={-2}
                      max={2}
                      step={0.1}
                      flex={1}
                      colorScheme={primaryColor}
                      value={draft.parameters.frequencyPenalty}
                      onChange={(v) => updateParam("frequencyPenalty", v)}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                    <NumberInput
                      min={-2}
                      max={2}
                      step={0.1}
                      size="xs"
                      maxW={20}
                      value={draft.parameters.frequencyPenalty}
                      onChange={(_, v) => {
                        if (!isNaN(v)) updateParam("frequencyPenalty", v);
                      }}
                    >
                      <NumberInputField textAlign="right" />
                      <NumberInputStepper>
                        <NumberIncrementStepper>
                          <LuChevronUp size={8} />
                        </NumberIncrementStepper>
                        <NumberDecrementStepper>
                          <LuChevronDown size={8} />
                        </NumberDecrementStepper>
                      </NumberInputStepper>
                    </NumberInput>
                  </HStack>
                ),
              },
              {
                title: t(
                  "LLMProviderSettingsModal.content.parameters.presencePenalty.title"
                ),
                description: t(
                  "LLMProviderSettingsModal.content.parameters.presencePenalty.description"
                ),
                children: (
                  <HStack spacing={4} w="40%">
                    <Slider
                      min={-2}
                      max={2}
                      step={0.1}
                      flex={1}
                      colorScheme={primaryColor}
                      value={draft.parameters.presencePenalty}
                      onChange={(v) => updateParam("presencePenalty", v)}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                    <NumberInput
                      min={-2}
                      max={2}
                      step={0.1}
                      size="xs"
                      maxW={20}
                      value={draft.parameters.presencePenalty}
                      onChange={(_, v) => {
                        if (!isNaN(v)) updateParam("presencePenalty", v);
                      }}
                    >
                      <NumberInputField textAlign="right" />
                      <NumberInputStepper>
                        <NumberIncrementStepper>
                          <LuChevronUp size={8} />
                        </NumberIncrementStepper>
                        <NumberDecrementStepper>
                          <LuChevronDown size={8} />
                        </NumberDecrementStepper>
                      </NumberInputStepper>
                    </NumberInput>
                  </HStack>
                ),
              },
            ]
          : []),
      ],
    },
  ];

  const canSubmit = draft.name.trim() && modelAvailability;

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      autoFocus={false}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
        <ModalHeader>
          {t(
            `LLMProviderSettingsModal.header.title.${provider.name ? "edit" : "add"}`
          )}
        </ModalHeader>
        <ModalBody>
          <VStack spacing={3} align="stretch">
            {formItems.map((group, i) => (
              <OptionItemGroup
                title={group.title}
                items={group.items}
                key={i}
              />
            ))}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onCancel}>
            {t("General.cancel")}
          </Button>
          <Button
            variant="solid"
            colorScheme={primaryColor}
            onClick={onSave.bind(null, draft)}
            disabled={!canSubmit}
          >
            {t("General.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default LLMProviderSettingsModal;

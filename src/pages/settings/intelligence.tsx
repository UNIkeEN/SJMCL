import {
  Badge,
  Box,
  Button,
  Collapse,
  HStack,
  Icon,
  IconButton,
  Input,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Select,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Switch,
  Tag,
  TagLabel,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCheck,
  LuChevronDown,
  LuChevronUp,
  LuPencil,
  LuPlus,
  LuSparkles,
  LuStar,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { CommonIconButton } from "@/components/common/common-icon-button";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { LLMProviderType, ProviderConfig } from "@/models/config";
import { IntelligenceService } from "@/services/intelligence";

const PROVIDER_OPTIONS: { value: LLMProviderType; labelKey: string }[] = [
  {
    value: "openAiCompatible",
    labelKey: "IntelligenceSettingsPage.providerType.options.openAiCompatible",
  },
  {
    value: "anthropic",
    labelKey: "IntelligenceSettingsPage.providerType.options.anthropic",
  },
  {
    value: "gemini",
    labelKey: "IntelligenceSettingsPage.providerType.options.gemini",
  },
];

const DEFAULT_PARAMETERS = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
};

function createDefaultProvider(): ProviderConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    enabled: true,
    priority: 0,
    providerType: "openAiCompatible",
    baseUrl: "",
    apiKey: "",
    model: "",
    parameters: { ...DEFAULT_PARAMETERS },
  };
}

// ─── Provider Edit Form ───

interface ProviderEditFormProps {
  provider: ProviderConfig;
  onSave: (provider: ProviderConfig) => void;
  onCancel: () => void;
  primaryColor: string;
}

const ProviderEditForm: React.FC<ProviderEditFormProps> = ({
  provider: initial,
  onSave,
  onCancel,
  primaryColor,
}) => {
  const { t } = useTranslation();

  const [draft, setDraft] = useState<ProviderConfig>({ ...initial });
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

  const update = <K extends keyof ProviderConfig>(
    key: K,
    value: ProviderConfig[K]
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
      title: t("IntelligenceSettingsPage.model.title"),
      items: [
        // Provider name
        {
          title: t("IntelligenceSettingsPage.providers.name"),
          children: (
            <Input
              size="xs"
              w="60%"
              focusBorderColor={`${primaryColor}.500`}
              placeholder={t(
                "IntelligenceSettingsPage.providers.namePlaceholder"
              )}
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
            />
          ),
        },
        // Provider type
        {
          title: t("IntelligenceSettingsPage.providerType.title"),
          children: (
            <Select
              size="xs"
              w="60%"
              focusBorderColor={`${primaryColor}.500`}
              value={draft.providerType}
              onChange={(e) => {
                update("providerType", e.target.value as LLMProviderType);
                setModelAvailability(null);
                setAvailableModels([]);
                update("model", "");
              }}
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </Select>
          ),
        },
        // Base URL (OpenAI only)
        ...(showBaseUrl
          ? [
              {
                title: t(
                  "IntelligenceSettingsPage.model.settings.baseUrl.title"
                ),
                children: (
                  <VStack w="60%" alignItems="start">
                    <Input
                      size="xs"
                      w="full"
                      focusBorderColor={`${primaryColor}.500`}
                      value={draft.baseUrl}
                      onChange={(e) => update("baseUrl", e.target.value)}
                    />
                    <Text fontSize="xs" className="secondary-text">
                      {t(
                        "IntelligenceSettingsPage.model.settings.baseUrl.fullUrl",
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
                  "IntelligenceSettingsPage.model.settings.endpoint.title"
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
          title: t("IntelligenceSettingsPage.model.settings.apiKey.title"),
          children: (
            <Input
              size="xs"
              w="60%"
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
          title: t("IntelligenceSettingsPage.model.settings.model.title"),
          children: (
            <Select
              size="xs"
              w="60%"
              focusBorderColor={`${primaryColor}.500`}
              value={draft.model}
              onChange={(e) => update("model", e.target.value)}
              isDisabled={!canCheck || isChecking || !modelAvailability}
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          ),
        },
        // Availability check
        {
          title: t(
            "IntelligenceSettingsPage.model.settings.checkAvailability.title"
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
                              "IntelligenceSettingsPage.model.settings.checkAvailability.available"
                            )}
                          </TagLabel>
                        </>
                      ) : (
                        <>
                          <LuX />
                          <TagLabel>
                            {t(
                              "IntelligenceSettingsPage.model.settings.checkAvailability.unavailable"
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
      title: t("IntelligenceSettingsPage.parameters.title"),
      items: [
        {
          title: t("IntelligenceSettingsPage.parameters.temperature.title"),
          description: t(
            "IntelligenceSettingsPage.parameters.temperature.description"
          ),
          children: (
            <HStack spacing={4} w="50%">
              <Slider
                min={0}
                max={2}
                step={0.1}
                w="full"
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
                maxW={16}
                value={draft.parameters.temperature}
                onChange={(_, v) => {
                  if (!isNaN(v)) updateParam("temperature", v);
                }}
              >
                <NumberInputField pr={0} />
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
          title: t("IntelligenceSettingsPage.parameters.maxTokens.title"),
          description: t(
            "IntelligenceSettingsPage.parameters.maxTokens.description"
          ),
          children: (
            <NumberInput
              min={1}
              max={128000}
              size="xs"
              maxW={20}
              value={draft.parameters.maxTokens}
              onChange={(_, v) => {
                if (!isNaN(v)) updateParam("maxTokens", v);
              }}
            >
              <NumberInputField />
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
          title: t("IntelligenceSettingsPage.parameters.topP.title"),
          description: t(
            "IntelligenceSettingsPage.parameters.topP.description"
          ),
          children: (
            <HStack spacing={4} w="50%">
              <Slider
                min={0}
                max={1}
                step={0.05}
                w="full"
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
                maxW={16}
                value={draft.parameters.topP}
                onChange={(_, v) => {
                  if (!isNaN(v)) updateParam("topP", v);
                }}
              >
                <NumberInputField pr={0} />
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
                  "IntelligenceSettingsPage.parameters.frequencyPenalty.title"
                ),
                description: t(
                  "IntelligenceSettingsPage.parameters.frequencyPenalty.description"
                ),
                children: (
                  <HStack spacing={4} w="50%">
                    <Slider
                      min={-2}
                      max={2}
                      step={0.1}
                      w="full"
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
                      maxW={16}
                      value={draft.parameters.frequencyPenalty}
                      onChange={(_, v) => {
                        if (!isNaN(v)) updateParam("frequencyPenalty", v);
                      }}
                    >
                      <NumberInputField pr={0} />
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
                  "IntelligenceSettingsPage.parameters.presencePenalty.title"
                ),
                description: t(
                  "IntelligenceSettingsPage.parameters.presencePenalty.description"
                ),
                children: (
                  <HStack spacing={4} w="50%">
                    <Slider
                      min={-2}
                      max={2}
                      step={0.1}
                      w="full"
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
                      maxW={16}
                      value={draft.parameters.presencePenalty}
                      onChange={(_, v) => {
                        if (!isNaN(v)) updateParam("presencePenalty", v);
                      }}
                    >
                      <NumberInputField pr={0} />
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

  return (
    <VStack w="full" spacing={3} align="stretch" py={2}>
      {formItems.map((group, i) => (
        <OptionItemGroup title={group.title} items={group.items} key={i} />
      ))}
      <HStack justify="flex-end" spacing={2} pt={1}>
        <Button size="xs" variant="ghost" onClick={onCancel}>
          {t("IntelligenceSettingsPage.providers.cancel")}
        </Button>
        <Button
          size="xs"
          colorScheme={primaryColor}
          onClick={() => onSave(draft)}
          isDisabled={!draft.name.trim()}
        >
          {t("IntelligenceSettingsPage.providers.save")}
        </Button>
      </HStack>
    </VStack>
  );
};

// ─── Provider Card ───

interface ProviderCardProps {
  provider: ProviderConfig;
  isActive: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSetActive: () => void;
  onDelete: () => void;
  onSave: (provider: ProviderConfig) => void;
  primaryColor: string;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  isActive,
  isExpanded,
  onToggleExpand,
  onSetActive,
  onDelete,
  onSave,
  primaryColor,
}) => {
  const { t } = useTranslation();
  const cardBg = useColorModeValue("white", "gray.700");
  const borderColor = useColorModeValue(
    isActive ? `${primaryColor}.300` : "gray.200",
    isActive ? `${primaryColor}.500` : "gray.600"
  );

  const providerLabel = PROVIDER_OPTIONS.find(
    (o) => o.value === provider.providerType
  );

  return (
    <Box
      borderWidth={1}
      borderColor={borderColor}
      borderRadius="md"
      bg={cardBg}
      overflow="hidden"
    >
      {/* Compact header */}
      <HStack
        px={3}
        py={2}
        justify="space-between"
        cursor="pointer"
        onClick={onToggleExpand}
        _hover={{ bg: useColorModeValue("gray.50", "gray.650") }}
      >
        <HStack spacing={2} flex={1} minW={0}>
          {isActive && (
            <Icon as={LuStar} color={`${primaryColor}.500`} boxSize={3.5} />
          )}
          <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
            {provider.name || "Unnamed"}
          </Text>
          <Badge fontSize="2xs" colorScheme="gray" variant="subtle">
            {providerLabel ? t(providerLabel.labelKey) : provider.providerType}
          </Badge>
          {provider.model && (
            <Text fontSize="xs" className="secondary-text" noOfLines={1}>
              {provider.model}
            </Text>
          )}
          {!provider.enabled && (
            <Badge fontSize="2xs" colorScheme="red" variant="subtle">
              disabled
            </Badge>
          )}
        </HStack>
        <HStack spacing={1} onClick={(e) => e.stopPropagation()}>
          {!isActive && (
            <IconButton
              aria-label={t("IntelligenceSettingsPage.providers.setActive")}
              icon={<LuStar size={12} />}
              size="xs"
              variant="ghost"
              onClick={onSetActive}
            />
          )}
          <IconButton
            aria-label={t("IntelligenceSettingsPage.providers.edit")}
            icon={<LuPencil size={12} />}
            size="xs"
            variant="ghost"
            onClick={onToggleExpand}
          />
          <IconButton
            aria-label={t("IntelligenceSettingsPage.providers.delete")}
            icon={<LuTrash2 size={12} />}
            size="xs"
            variant="ghost"
            colorScheme="red"
            onClick={onDelete}
          />
        </HStack>
      </HStack>

      {/* Inline edit form */}
      <Collapse in={isExpanded} animateOpacity>
        <Box px={3} pb={3} borderTopWidth={1} borderTopColor={borderColor}>
          <ProviderEditForm
            provider={provider}
            onSave={onSave}
            onCancel={onToggleExpand}
            primaryColor={primaryColor}
          />
        </Box>
      </Collapse>
    </Box>
  );
};

// ─── Main Page ───

const SparklesIconBox = () => {
  const bg = useColorModeValue(
    `
    radial-gradient(circle at top left,     #4299E1 0%, transparent 70%),
    radial-gradient(circle at top right,    #ED64A6 0%, transparent 70%),
    radial-gradient(circle at bottom left,  #ED8936 0%, transparent 70%),
    radial-gradient(circle at bottom right, #ED64A6 0%, transparent 70%)
    `,
    "linear-gradient(135deg, #171923, #2D3748)"
  );

  return (
    <Box
      boxSize="32px"
      borderRadius="4px"
      bg={bg}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Icon as={LuSparkles} boxSize="16px" color="white" />
    </Box>
  );
};

const IntelligenceSettingsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config, setConfig, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const intelligence = config.intelligence;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const handleSaveProvider = useCallback(
    async (provider: ProviderConfig) => {
      const resp = await IntelligenceService.saveIntelligenceProvider(provider);
      if (resp.status === "success") {
        setConfig((prev) => {
          const providers = [...prev.intelligence.providers];
          const idx = providers.findIndex((p) => p.id === provider.id);
          if (idx >= 0) {
            providers[idx] = provider;
          } else {
            providers.push(provider);
          }
          // If this is the first provider, auto-set as active
          const activeId =
            prev.intelligence.activeProviderId ||
            (providers.length === 1
              ? provider.id
              : prev.intelligence.activeProviderId);
          if (activeId !== prev.intelligence.activeProviderId) {
            IntelligenceService.setActiveIntelligenceProvider(activeId);
          }
          return {
            ...prev,
            intelligence: {
              ...prev.intelligence,
              providers,
              activeProviderId: activeId,
            },
          };
        });
        setExpandedId(null);
        setAddingNew(false);
      } else {
        toast({ title: resp.message, status: "error" });
      }
    },
    [setConfig, toast]
  );

  const handleDeleteProvider = useCallback(
    async (providerId: string) => {
      const resp =
        await IntelligenceService.deleteIntelligenceProvider(providerId);
      if (resp.status === "success") {
        setConfig((prev) => {
          const providers = prev.intelligence.providers.filter(
            (p) => p.id !== providerId
          );
          const activeId =
            prev.intelligence.activeProviderId === providerId
              ? ""
              : prev.intelligence.activeProviderId;
          return {
            ...prev,
            intelligence: {
              ...prev.intelligence,
              providers,
              activeProviderId: activeId,
            },
          };
        });
        setExpandedId(null);
      }
    },
    [setConfig]
  );

  const handleSetActive = useCallback(
    async (providerId: string) => {
      const resp =
        await IntelligenceService.setActiveIntelligenceProvider(providerId);
      if (resp.status === "success") {
        setConfig((prev) => ({
          ...prev,
          intelligence: { ...prev.intelligence, activeProviderId: providerId },
        }));
      }
    },
    [setConfig]
  );

  // Master switch group
  const masterSwitchGroup: OptionItemGroupProps = {
    items: [
      {
        prefixElement: <SparklesIconBox />,
        title: t("IntelligenceSettingsPage.masterSwitch.title"),
        description: t("IntelligenceSettingsPage.masterSwitch.description"),
        children: (
          <Switch
            colorScheme={primaryColor}
            isChecked={intelligence.enabled}
            onChange={(e) => update("intelligence.enabled", e.target.checked)}
          />
        ),
      },
    ],
  };

  return (
    <>
      <OptionItemGroup
        title={masterSwitchGroup.title}
        items={masterSwitchGroup.items}
      />

      {intelligence.enabled && (
        <VStack spacing={3} align="stretch" mt={3}>
          {/* Failover hint */}
          <Text fontSize="xs" className="secondary-text" px={1}>
            {t("IntelligenceSettingsPage.providers.failoverHint")}
          </Text>

          {/* Provider list */}
          {intelligence.providers.length === 0 && !addingNew && (
            <Text
              fontSize="sm"
              className="secondary-text"
              textAlign="center"
              py={4}
            >
              {t("IntelligenceSettingsPage.providers.empty")}
            </Text>
          )}

          {intelligence.providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isActive={intelligence.activeProviderId === provider.id}
              isExpanded={expandedId === provider.id}
              onToggleExpand={() =>
                setExpandedId((prev) =>
                  prev === provider.id ? null : provider.id
                )
              }
              onSetActive={() => handleSetActive(provider.id)}
              onDelete={() => handleDeleteProvider(provider.id)}
              onSave={handleSaveProvider}
              primaryColor={primaryColor}
            />
          ))}

          {/* Add new provider form */}
          {addingNew && (
            <Box borderWidth={1} borderColor="gray.200" borderRadius="md" p={3}>
              <ProviderEditForm
                provider={createDefaultProvider()}
                onSave={handleSaveProvider}
                onCancel={() => setAddingNew(false)}
                primaryColor={primaryColor}
              />
            </Box>
          )}

          {/* Add button */}
          {!addingNew && (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<LuPlus size={14} />}
              onClick={() => setAddingNew(true)}
            >
              {t("IntelligenceSettingsPage.providers.add")}
            </Button>
          )}
        </VStack>
      )}
    </>
  );
};

export default IntelligenceSettingsPage;

import {
  Box,
  HStack,
  Icon,
  Input,
  Select,
  Switch,
  Tag,
  TagLabel,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuSparkles, LuX } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { CommonIconButton } from "@/components/common/common-icon-button";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { IntelligenceService } from "@/services/intelligence";

const IntelligenceSettingsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const intelligenceConfigs = config.intelligence;

  const [baseUrl, setBaseUrl] = useState<string>(
    intelligenceConfigs.model.baseUrl || ""
  );
  const [apiKey, setApiKey] = useState<string>(
    intelligenceConfigs.model.apiKey || ""
  );
  const [isApiKeyEditing, setIsApiKeyEditing] = useState<boolean>(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [model, setModel] = useState<string | null>(
    intelligenceConfigs.model.model || null
  );
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [modelAvailability, setModelAvailability] = useState<boolean | null>(
    null
  );

  const maskedApiKey = useMemo(() => {
    if (!apiKey) return "";
    return "*".repeat(Math.max(2, apiKey.length));
  }, [apiKey]);

  const SparklesIconBox = () => {
    const bg = useColorModeValue(
      // light mode: colorful background
      `
      radial-gradient(circle at top left,     #4299E1 0%, transparent 70%),   // blue.400
      radial-gradient(circle at top right,    #ED64A6 0%, transparent 70%),   // pink.400
      radial-gradient(circle at bottom left,  #ED8936 0%, transparent 70%),   // orange.400
      radial-gradient(circle at bottom right, #ED64A6 0%, transparent 70%)
      `,
      // dark mode: neutral gray background
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

  // auto check model service availability on input change
  const trimmed = useMemo(() => {
    const b = baseUrl.trim();
    const k = apiKey.trim();
    return { b, k, ok: !!b && !!k };
  }, [baseUrl, apiKey]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCheckLLMAvailability = useCallback(
    (b: string, k: string) => {
      setIsChecking(true);
      setModelAvailability(null);

      IntelligenceService.retrieveLLMModels(b, k)
        .then((resp) => {
          if (resp.status === "success") {
            setModelAvailability(true);
            setAvailableModels(resp.data);
            setModel((prevModel) => {
              const nextModel = resp.data.includes(prevModel || "")
                ? prevModel
                : (resp.data[0] ?? null);

              if (nextModel !== prevModel) {
                update("intelligence.model.model", nextModel);
              }

              return nextModel;
            });
          } else {
            setModelAvailability(false);
            setModel(null);
            setAvailableModels([]);
          }
          setIsChecking(false);
        })
        .catch((err) => {
          logger.error("Retrieve LLM models error:", err);
          setModelAvailability(false);
          setIsChecking(false);
        });
    },
    [update]
  );

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!trimmed.ok) {
      setModelAvailability(null);
      setIsChecking(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      handleCheckLLMAvailability(trimmed.b, trimmed.k);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [trimmed.b, trimmed.k, trimmed.ok, handleCheckLLMAvailability]);

  const onManualRefreshAvailability = useCallback(() => {
    if (!trimmed.ok || isChecking) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    handleCheckLLMAvailability(trimmed.b, trimmed.k);
  }, [
    trimmed.ok,
    trimmed.b,
    trimmed.k,
    isChecking,
    handleCheckLLMAvailability,
  ]);

  // settings items
  const intelligenceSettingGroups: OptionItemGroupProps[] = [
    {
      items: [
        {
          prefixElement: <SparklesIconBox />,
          title: t("IntelligenceSettingsPage.masterSwitch.title"),
          description: t("IntelligenceSettingsPage.masterSwitch.description"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={intelligenceConfigs.enabled}
              onChange={(e) => {
                update("intelligence.enabled", e.target.checked);
              }}
            />
          ),
        },
      ],
    },
    ...(intelligenceConfigs.enabled
      ? [
          {
            title: t("IntelligenceSettingsPage.model.title"),
            items: [
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
                      value={baseUrl}
                      onChange={(event) => {
                        setBaseUrl(event.target.value);
                      }}
                      onBlur={() => {
                        update("intelligence.model.baseUrl", baseUrl);
                      }}
                    />
                    <Text fontSize="xs" className="secondary-text">
                      {t(
                        "IntelligenceSettingsPage.model.settings.baseUrl.fullUrl",
                        { url: `${baseUrl}/v1/chat/completions` }
                      )}
                    </Text>
                  </VStack>
                ),
              },
              {
                title: t(
                  "IntelligenceSettingsPage.model.settings.apiKey.title"
                ),
                children: (
                  <Input
                    size="xs"
                    w="60%"
                    focusBorderColor={`${primaryColor}.500`}
                    value={isApiKeyEditing ? apiKey : maskedApiKey}
                    onChange={(event) => {
                      if (!isApiKeyEditing) return;
                      setApiKey(event.target.value);
                    }}
                    onFocus={() => {
                      setIsApiKeyEditing(true);
                    }}
                    onBlur={() => {
                      setIsApiKeyEditing(false);
                      update("intelligence.model.apiKey", apiKey);
                    }}
                  />
                ),
              },
              {
                title: t("IntelligenceSettingsPage.model.settings.model.title"),
                children: (
                  <Select
                    size="xs"
                    w="60%"
                    focusBorderColor={`${primaryColor}.500`}
                    value={model || ""}
                    onChange={(event) => {
                      setModel(event.target.value);
                    }}
                    onBlur={() => {
                      update("intelligence.model.model", model);
                    }}
                    isDisabled={!trimmed.ok || isChecking || !modelAvailability}
                  >
                    {availableModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </Select>
                ),
              },
              {
                title: t(
                  "IntelligenceSettingsPage.model.settings.checkAvailability.title"
                ),
                children: (
                  <HStack spacing={1}>
                    {!trimmed.ok || modelAvailability === null ? (
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
                          onClick={onManualRefreshAvailability}
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
        ]
      : []),
  ];

  return (
    <>
      {intelligenceSettingGroups.map((group, index) => (
        <OptionItemGroup title={group.title} items={group.items} key={index} />
      ))}
    </>
  );
};

export default IntelligenceSettingsPage;

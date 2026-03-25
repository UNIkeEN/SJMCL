import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  HStack,
  Icon,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Portal,
  Switch,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaRegStar, FaStar } from "react-icons/fa6";
import { LuPencil, LuPlus, LuSparkles, LuTrash2 } from "react-icons/lu";
import Empty from "@/components/common/empty";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import LLMProviderSettingsModal from "@/components/modals/llm-provider-settings-modal";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { useThemedCSSStyle } from "@/hooks/themed-css";
import { LLMProviderConfig, defaultLLMProviderConfig } from "@/models/config";
import { IntelligenceService } from "@/services/intelligence";

interface ProviderCardProps {
  provider: LLMProviderConfig;
  isActive: boolean;
  onEdit: () => void;
  onSetActive: () => void;
  onDelete: () => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  isActive,
  onEdit,
  onSetActive,
  onDelete,
}) => {
  const { t } = useTranslation();
  const themedStyles = useThemedCSSStyle();

  return (
    <Card className={themedStyles.card["card-front"]}>
      {/* Compact header */}
      <HStack justify="space-between">
        <HStack spacing={2} flex={1} minW={0}>
          <IconButton
            aria-label={t("IntelligenceSettingsPage.setActive")}
            icon={isActive ? <FaStar size={12} /> : <FaRegStar size={12} />}
            size="xs"
            variant="ghost"
            color={isActive ? "yellow.500" : "gray.500"}
            onClick={isActive ? undefined : onSetActive}
          />
          <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
            {provider.name || "Unnamed"}
          </Text>
          <Badge fontSize="2xs" colorScheme="gray" variant="subtle">
            {t(
              `IntelligenceSettingsPage.providerType.${provider.providerType}`
            )}
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
        <HStack spacing={1}>
          <IconButton
            aria-label={t("IntelligenceSettingsPage.edit")}
            icon={<LuPencil size={12} />}
            size="xs"
            variant="ghost"
            onClick={onEdit}
          />
          <Popover size="xs" trigger="click" placement="top">
            <PopoverTrigger>
              <IconButton
                aria-label={t("IntelligenceSettingsPage.delete")}
                icon={<LuTrash2 size={12} />}
                size="xs"
                variant="ghost"
                colorScheme="red"
              />
            </PopoverTrigger>
            <Portal>
              <PopoverContent w={48} m={1.5}>
                <PopoverArrow />
                <PopoverBody
                  display="flex"
                  flexDir="column"
                  justifyContent="space-between"
                  gap={3}
                >
                  <Text fontWeight="bold" fontSize="sm">
                    {t("IntelligenceSettingsPage.deleteConfirm")}
                  </Text>
                  <Flex justify="flex-end">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={onDelete}
                      colorScheme="red"
                    >
                      {t("IntelligenceSettingsPage.delete")}
                    </Button>
                  </Flex>
                </PopoverBody>
              </PopoverContent>
            </Portal>
          </Popover>
        </HStack>
      </HStack>
    </Card>
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

  const [currentProviderId, setCurrentProviderId] = useState<string | null>(
    null
  );

  const handleSaveProvider = useCallback(
    async (provider: LLMProviderConfig) => {
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
        setCurrentProviderId(null);
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
        setCurrentProviderId(null);
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
            {t("IntelligenceSettingsPage.failoverHint")}
          </Text>

          {/* Provider list */}
          {intelligence.providers.length === 0 && <Empty />}

          {intelligence.providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isActive={intelligence.activeProviderId === provider.id}
              onEdit={() => setCurrentProviderId(provider.id)}
              onSetActive={() => handleSetActive(provider.id)}
              onDelete={() => handleDeleteProvider(provider.id)}
            />
          ))}

          <Button
            size="sm"
            variant="solid"
            leftIcon={<LuPlus size={14} />}
            onClick={() => setCurrentProviderId(crypto.randomUUID())}
          >
            {t("IntelligenceSettingsPage.add")}
          </Button>
        </VStack>
      )}

      <LLMProviderSettingsModal
        provider={
          intelligence.providers.find((p) => p.id === currentProviderId) || {
            ...defaultLLMProviderConfig,
            id: currentProviderId!,
          }
        }
        onSave={handleSaveProvider}
        onCancel={() => setCurrentProviderId(null)}
        isOpen={!!currentProviderId}
        onClose={() => setCurrentProviderId(null)}
      />
    </>
  );
};

export default IntelligenceSettingsPage;

import {
  Box,
  Icon,
  NumberInput,
  NumberInputField,
  Switch,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuSparkles } from "react-icons/lu";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";

const IntelligenceSettingsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [port, setPort] = useState<number>(
    config.intelligence.mcpServer.launcher.port
  );

  useEffect(() => {
    setPort(config.intelligence.mcpServer.launcher.port);
  }, [config.intelligence.mcpServer.launcher.port]);

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

  const settingsGroups: OptionItemGroupProps[] = [
    {
      items: [
        {
          prefixElement: <SparklesIconBox />,
          title: t("IntelligenceSettingsPage.title"),
          description: t("IntelligenceSettingsPage.description"),
          children: <></>,
        },
      ],
    },
    {
      title: t("IntelligenceSettingsPage.mcpServer.title"),
      headExtra: (
        <Box display="flex" alignItems="center">
          <Text fontSize="xs" className="secondary-text">
            {t("IntelligenceSettingsPage.mcpServer.headExtra")}
          </Text>
        </Box>
      ),
      items: [
        {
          title: t("IntelligenceSettingsPage.mcpServer.settings.enabled.title"),
          description: t(
            "IntelligenceSettingsPage.mcpServer.settings.enabled.description"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={config.intelligence.mcpServer.launcher.enabled}
              onChange={(e) => {
                update(
                  "intelligence.mcpServer.launcher.enabled",
                  e.target.checked
                );
              }}
            />
          ),
        },
        ...(config.intelligence.mcpServer.launcher.enabled
          ? [
              {
                title: t(
                  "IntelligenceSettingsPage.mcpServer.settings.port.title"
                ),
                description: t(
                  "IntelligenceSettingsPage.mcpServer.settings.port.description"
                ),
                children: (
                  <NumberInput
                    min={1}
                    max={65535}
                    size="xs"
                    maxW={16}
                    value={port}
                    onChange={(value) => {
                      if (!/^\d*$/.test(value)) return;
                      setPort(Number(value));
                    }}
                    onBlur={() => {
                      const nextPort = Math.max(
                        1,
                        Math.min(port || 18970, 65535)
                      );
                      setPort(nextPort);
                      update("intelligence.mcpServer.launcher.port", nextPort);
                    }}
                  >
                    <NumberInputField pr={0} />
                  </NumberInput>
                ),
              },
            ]
          : []),
      ],
    },
  ];

  return (
    <>
      {settingsGroups.map((group, index) => (
        <OptionItemGroup key={index} {...group} />
      ))}
    </>
  );
};

export default IntelligenceSettingsPage;

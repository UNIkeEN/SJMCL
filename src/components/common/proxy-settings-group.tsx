import {
  HStack,
  Input,
  NumberInput,
  NumberInputField,
  Switch,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { OptionItemProps } from "@/components/common/option-item";
import SegmentedControl from "@/components/common/segmented";
import { useLauncherConfig } from "@/contexts/config";

interface ProxyConfig {
  enabled: boolean;
  selectedType: string;
  host: string;
  port: number;
}

export function useProxySettingsItems(
  rootKey: string,
  config: ProxyConfig,
  onUpdate: (key: string, value: any) => void
): OptionItemProps[] {
  const { t } = useTranslation();
  const { config: launcherConfig } = useLauncherConfig();
  const primaryColor = launcherConfig.appearance.theme.primaryColor;

  const [proxyHost, setProxyHost] = useState<string>(config.host);
  const [proxyPort, setProxyPort] = useState<number>(config.port);

  const proxyTypeOptions = [
    { label: "HTTP", value: "http" },
    { label: "Socks", value: "socks" },
  ];

  return [
    {
      title: t(`${rootKey}.settings.enabled.title`),
      description: !config.enabled
        ? t(`${rootKey}.settings.enabled.description`)
        : undefined,
      children: (
        <Switch
          colorScheme={primaryColor}
          isChecked={config.enabled}
          onChange={(event) => {
            onUpdate("enabled", event.target.checked);
          }}
        />
      ),
    },
    ...(config.enabled
      ? [
          {
            title: t("ProxySettingsGroup.type.title"),
            children: (
              <HStack>
                <SegmentedControl
                  selected={config.selectedType}
                  onSelectItem={(s) => {
                    onUpdate("selectedType", s as string);
                  }}
                  size="xs"
                  items={proxyTypeOptions}
                />
              </HStack>
            ),
          },
          {
            title: t("ProxySettingsGroup.host.title"),
            children: (
              <Input
                size="xs"
                w="107px"
                focusBorderColor={`${primaryColor}.500`}
                value={proxyHost}
                onChange={(event) => {
                  setProxyHost(event.target.value);
                }}
                onBlur={() => {
                  onUpdate("host", proxyHost);
                }}
              />
            ),
          },
          {
            title: t("ProxySettingsGroup.port.title"),
            children: (
              <NumberInput
                size="xs"
                maxW={16}
                min={0}
                max={65535}
                focusBorderColor={`${primaryColor}.500`}
                value={proxyPort || 80}
                onChange={(value) => {
                  if (!/^\d*$/.test(value)) return;
                  setProxyPort(Number(value));
                }}
                onBlur={() => {
                  onUpdate(
                    "port",
                    Math.max(0, Math.min(proxyPort || 80, 65535))
                  );
                }}
              >
                <NumberInputField pr={0} />
              </NumberInput>
            ),
          },
        ]
      : []),
  ];
}

import {
  Flex,
  HStack,
  Icon,
  IconButton,
  Tag,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuArrowDownToLine,
  LuFolderOpen,
  LuPlus,
  LuRefreshCcw,
} from "react-icons/lu";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { JavaInfo } from "@/models/system-info";

const JavaSettingsPage = () => {
  const { t } = useTranslation();
  const { config, getJavaInfos } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [javaInfos, setJavaInfos] = useState<JavaInfo[]>([]);

  useEffect(() => {
    setJavaInfos(getJavaInfos() || []);
  }, [getJavaInfos]);

  return (
    <Section
      title={t("JavaSettingsPage.javaList.title")}
      headExtra={
        <HStack spacing={2}>
          <Tooltip label={t("JavaSettingsPage.javaList.download")}>
            <IconButton
              aria-label={t("JavaSettingsPage.javaList.download")}
              icon={<Icon as={LuArrowDownToLine} boxSize={3.5} />}
              size="xs"
              h={21}
              variant="ghost"
            />
          </Tooltip>
          <Tooltip label={t("General.refresh")}>
            <IconButton
              aria-label={t("General.refresh")}
              icon={<Icon as={LuRefreshCcw} boxSize={3.5} />}
              size="xs"
              h={21}
              variant="ghost"
              onClick={() => getJavaInfos(true)}
            />
          </Tooltip>
          <Tooltip label={t("JavaSettingsPage.javaList.add")}>
            <IconButton
              aria-label={t("JavaSettingsPage.javaList.add")}
              icon={<Icon as={LuPlus} boxSize={3.5} />}
              size="xs"
              h={21}
              variant="ghost"
            />
          </Tooltip>
        </HStack>
      }
    >
      {javaInfos.length > 0 ? (
        <OptionItemGroup
          items={javaInfos.map((info) => (
            <OptionItem
              key={info.name}
              title={info.name}
              description={
                <Text
                  fontSize="xs"
                  className="secondary-text no-select"
                  wordBreak="break-all"
                >
                  {info.execPath}
                </Text>
              }
              titleExtra={
                <Flex>
                  <HStack spacing={2}>
                    <Tag
                      className="tag-xs"
                      variant="subtle"
                      colorScheme={primaryColor}
                    >
                      {`Java ${info.majorVersion}${info.isLts ? " (LTS)" : ""}`}
                    </Tag>
                    <Text fontSize="xs" color={`${primaryColor}.500`}>
                      {info.vendor}
                    </Text>
                  </HStack>
                </Flex>
              }
            >
              <Tooltip label={t("General.openFolder")}>
                <IconButton
                  aria-label={t("General.openFolder")}
                  icon={<LuFolderOpen />}
                  variant="ghost"
                  size="sm"
                  onClick={async () => await revealItemInDir(info.execPath)}
                />
              </Tooltip>
            </OptionItem>
          ))}
        />
      ) : (
        <Empty withIcon={false} size="sm" />
      )}
    </Section>
  );
};

export default JavaSettingsPage;

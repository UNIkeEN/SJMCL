import {
  Flex,
  HStack,
  Icon,
  IconButton,
  Tag,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import { useRouter } from "next/router";
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
import { mockJavaInfo } from "@/models/mock/system-info";
import { JavaInfo } from "@/models/system-info";

const JavaSettingsPage = () => {
  const [javaInfos, setJavaInfos] = useState<JavaInfo[]>([]);
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    setJavaInfos(mockJavaInfo);
  }, []);

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
              onClick={() => {
                router.push("/settings/java");
              }}
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
              description={info.fileDir}
              titleExtra={
                <Flex>
                  <HStack spacing={1}>
                    <Tag
                      className="tag-xs"
                      variant="subtle"
                      colorScheme={primaryColor}
                    >
                      {info.version}
                    </Tag>
                    <Text fontSize="xs" color={`${primaryColor}.500`}>
                      {info.architecture}
                    </Text>
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
                  onClick={() => open(info.fileDir)}
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

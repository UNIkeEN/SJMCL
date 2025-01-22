import { Flex, IconButton, Tag, Text, Tooltip } from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFolderOpen } from "react-icons/lu";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { mockJavaInfo } from "@/models/mock/system-info";
import { JavaInfo } from "@/models/system-info";

const JavaInfoPage = () => {
  const [javaInfo, setJavaInfo] = useState<JavaInfo[]>([]);
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const { t } = useTranslation();

  useEffect(() => {
    setJavaInfo(mockJavaInfo);
  }, []);

  return (
    <Section title={t("JavaInfoPage.javaList.title")}>
      {javaInfo.length > 0 ? (
        <OptionItemGroup
          items={javaInfo.map((info) => (
            <OptionItem
              key={info.name}
              title={info.name}
              description={info.fileDir}
              titleExtra={
                <Flex alignItems={"center"}>
                  <Tag size="sm" variant="subtle" colorScheme={primaryColor}>
                    {info.version}
                  </Tag>
                  <Text fontSize="xs" color={`${primaryColor}.500`} ml={2}>
                    {info.architecture}
                  </Text>
                  <Text fontSize="xs" color={`${primaryColor}.500`} ml={2}>
                    {info.vendor}
                  </Text>
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

export default JavaInfoPage;

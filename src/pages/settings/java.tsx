import { Flex, HStack, Tag, Text } from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { platform } from "@tauri-apps/plugin-os";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { JavaInfo } from "@/models/system-info";

const JavaSettingsPage = () => {
  const { t } = useTranslation();
  const { config, update, getJavaInfos } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [javaInfos, setJavaInfos] = useState<JavaInfo[]>([]);

  useEffect(() => {
    setJavaInfos(getJavaInfos() || []);
  }, [getJavaInfos]);

  const handleAddJavaPath = async () => {
    const newJavaPath = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Java",
          extensions: platform() === "windows" ? ["exe"] : [""], // TBD: cross platform test
        },
      ],
    });
    if (newJavaPath && typeof newJavaPath === "string") {
      const fileName = newJavaPath.split(/[/\\]/).pop();
      const isValidJava =
        platform() === "windows"
          ? fileName === "java.exe"
          : fileName === "java";
      if (isValidJava && !config.extraJavaPaths.includes(newJavaPath)) {
        update("extraJavaPaths", [...config.extraJavaPaths, newJavaPath]);
        setJavaInfos(getJavaInfos(true) || []);
      }
    }
  };

  const handleRemoveJavaPath = (java: JavaInfo) => {
    const updatedJavaPaths = config.extraJavaPaths.filter(
      (path) => path !== java.execPath
    );
    update("extraJavaPaths", updatedJavaPaths);
    setJavaInfos(getJavaInfos(true) || []);
  };

  const javaSecMenuOperations = [
    {
      icon: "download",
      label: t("JavaSettingsPage.javaList.download"),
    },
    {
      icon: "refresh",
      onClick: () => getJavaInfos(true),
    },
    {
      icon: "add",
      label: t("JavaSettingsPage.javaList.add"),
      onClick: () => handleAddJavaPath(),
    },
  ];

  const javaItemMenuOperations = (java: JavaInfo) => [
    ...(java.isUserAdded
      ? [
          {
            icon: LuX,
            label: t("JavaSettingsPage.javaList.remove"),
            onClick: () => handleRemoveJavaPath(java),
          },
        ]
      : []),
    {
      icon: "revealFile",
      onClick: () => async () => await revealItemInDir(java.execPath),
    },
  ];

  return (
    <Section
      title={t("JavaSettingsPage.javaList.title")}
      headExtra={
        <HStack spacing={2}>
          {javaSecMenuOperations.map((btn, index) => (
            <CommonIconButton
              key={index}
              icon={btn.icon}
              label={btn.label}
              onClick={btn.onClick}
              size="xs"
              fontSize="sm"
              h={21}
            />
          ))}
        </HStack>
      }
    >
      {javaInfos.length > 0 ? (
        <OptionItemGroup
          items={javaInfos.map((java) => (
            <OptionItem
              key={java.name}
              title={java.name}
              description={
                <Text
                  fontSize="xs"
                  className="secondary-text no-select"
                  wordBreak="break-all"
                >
                  {java.execPath}
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
                      {`Java ${java.majorVersion}${java.isLts ? " (LTS)" : ""}`}
                    </Tag>
                    <Text fontSize="xs" color={`${primaryColor}.500`}>
                      {java.vendor}
                    </Text>
                  </HStack>
                </Flex>
              }
            >
              <HStack spacing={0}>
                {javaItemMenuOperations(java).map((item, index) => (
                  <CommonIconButton
                    key={index}
                    icon={item.icon}
                    label={item.label}
                    onClick={item.onClick}
                  />
                ))}
              </HStack>
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

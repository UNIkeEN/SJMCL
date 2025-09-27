import { Flex, HStack, Tag, Text, useDisclosure } from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { DownloadJavaModal } from "@/components/modals/download-java-modal";
import ManualJavaPathModal from "@/components/modals/manual-java-path-modal";
import { useLauncherConfig } from "@/contexts/config";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { JavaInfo } from "@/models/system-info";
import { JavaPathValidator } from "@/utils/java-validation";

const JavaSettingsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config, update, getJavaInfos } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { closeSharedModal, openGenericConfirmDialog } = useSharedModals();

  const [javaInfos, setJavaInfos] = useState<JavaInfo[]>([]);
  const [selectedJava, setSelectedJava] = useState<JavaInfo | null>(null);

  useEffect(() => {
    setJavaInfos(getJavaInfos() || []);
  }, [getJavaInfos]);

  const {
    isOpen: isDownloadJavaModalOpen,
    onOpen: onDownloadJavaModalOpen,
    onClose: onDownloadJavaModalClose,
  } = useDisclosure();

  const {
    isOpen: isManualJavaPathModalOpen,
    onOpen: onManualJavaPathModalOpen,
    onClose: onManualJavaPathModalClose,
  } = useDisclosure();

  const handleAddJavaPath = async () => {
    const newJavaPath = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Java",
          extensions: config.basicInfo.platform === "windows" ? ["exe"] : [""], // TBD: cross platform test
        },
      ],
    });
    if (newJavaPath && typeof newJavaPath === "string") {
      await processJavaPath(newJavaPath);
    }
  };

  const processJavaPath = async (javaPath: string) => {
    const validationResult = await JavaPathValidator.validateJavaPath(
      javaPath,
      {
        platform: config.basicInfo.platform,
        existingJavaPaths: config.extraJavaPaths,
        javaInfos: javaInfos,
      }
    );

    if (!validationResult.isValid) {
      toast({
        title: t("JavaSettingsPage.toast.addFailed.title"),
        description: t(
          `JavaSettingsPage.toast.addFailed.${validationResult.error}`
        ),
        status: "error",
      });
      return;
    }

    // 添加成功
    update("extraJavaPaths", [...config.extraJavaPaths, javaPath]);
    setJavaInfos(getJavaInfos(true) || []);
    toast({
      title: t("JavaSettingsPage.toast.addSuccess.title"),
      description: t("JavaSettingsPage.toast.addSuccess.description"),
      status: "success",
    });
  };

  const handleManualJavaPathSubmit = async (javaPath: string) => {
    await processJavaPath(javaPath);
  };

  const handleRemoveJavaPath = (java: JavaInfo) => {
    setSelectedJava(java);
    openGenericConfirmDialog({
      title: t("JavaSettingsPage.confirmDelete.title"),
      body: t("JavaSettingsPage.confirmDelete.description"),
      isAlert: true,
      onOKCallback: handleConfirmDelete,
      showSuppressBtn: true,
      suppressKey: "deleteJavaPath",
    });
  };

  const handleConfirmDelete = () => {
    if (!selectedJava) return;

    const updatedJavaPaths = config.extraJavaPaths.filter(
      (path) => path !== selectedJava.execPath
    );
    update("extraJavaPaths", updatedJavaPaths);
    setJavaInfos(getJavaInfos(true) || []);
    closeSharedModal("generic-confirm");
    setSelectedJava(null);
  };

  const handleAddButtonClick = (event: React.MouseEvent) => {
    if (event.altKey) {
      onManualJavaPathModalOpen();
    } else {
      handleAddJavaPath();
    }
  };

  const javaSecMenuOperations = [
    {
      icon: "download",
      label: t("JavaSettingsPage.javaList.download"),
      onClick: () => onDownloadJavaModalOpen(),
    },
    {
      icon: "add",
      label: t("JavaSettingsPage.javaList.add"),
      onClick: handleAddButtonClick,
    },
    {
      icon: "refresh",
      onClick: () => getJavaInfos(true),
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
      onClick: () => revealItemInDir(java.execPath),
    },
  ];

  return (
    <>
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
                    className="secondary-text"
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
                titleFlex={true}
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
      <DownloadJavaModal
        isOpen={isDownloadJavaModalOpen}
        onClose={onDownloadJavaModalClose}
      />
      <ManualJavaPathModal
        isOpen={isManualJavaPathModalOpen}
        onClose={onManualJavaPathModalClose}
        onSubmit={handleManualJavaPathSubmit}
      />
    </>
  );
};

export default JavaSettingsPage;

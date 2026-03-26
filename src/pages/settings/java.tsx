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
import ManualAddJavaPathModal from "@/components/modals/manual-add-java-path-modal";
import { useLauncherConfig } from "@/contexts/config";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { JavaInfo } from "@/models/system-info";
import { ConfigService } from "@/services/config";

const JavaSettingsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config, update, getJavaInfos } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { closeSharedModal, openGenericConfirmDialog } = useSharedModals();

  const [javaInfos, setJavaInfos] = useState<JavaInfo[]>([]);
  const [selectedJava, setSelectedJava] = useState<JavaInfo | null>(null);

  // for manual add java path modal
  const [onSubmitCallback, setOnSubmitCallback] = useState<
    ((path: string | null) => void) | null
  >(null);

  useEffect(() => {
    setJavaInfos(getJavaInfos() || []);
  }, [getJavaInfos]);

  const {
    isOpen: isDownloadJavaModalOpen,
    onOpen: onDownloadJavaModalOpen,
    onClose: onDownloadJavaModalClose,
  } = useDisclosure();

  const {
    isOpen: isManualAddJavaPathModalOpen,
    onOpen: onManualAddJavaPathModalOpen,
    onClose: onManualAddJavaPathModalClose,
  } = useDisclosure();

  const handleAddJavaPath = async (useModal: boolean) => {
    let newJavaPath: string | null = null;
    if (useModal) {
      newJavaPath = await new Promise<string | null>((resolve) => {
        setOnSubmitCallback(() => (path: string | null) => {
          resolve(path);
          setOnSubmitCallback(null);
        });
        onManualAddJavaPathModalOpen();
      });
    } else {
      newJavaPath = await open({
        multiple: false,
        directory: false,
        ...(config.basicInfo.platform === "windows" && {
          filters: [
            {
              name: "Java",
              extensions: ["exe"],
            },
          ],
        }),
      });
    }

    if (newJavaPath && typeof newJavaPath === "string") {
      const fileName = newJavaPath.split(/[/\\]/).pop();
      const isValidFileName =
        config.basicInfo.platform === "windows"
          ? fileName === "java.exe"
          : fileName === "java";
      if (!isValidFileName) {
        toast({
          title: t("JavaSettingsPage.toast.addFailed.title"),
          description: t("JavaSettingsPage.toast.addFailed.invalid"),
          status: "error",
        });
        return;
      }

      const isDuplicated =
        config.extraJavaPaths.includes(newJavaPath) ||
        javaInfos.some((java) => java.execPath === newJavaPath);
      if (isDuplicated) {
        toast({
          title: t("JavaSettingsPage.toast.addFailed.title"),
          description: t("JavaSettingsPage.toast.addFailed.duplicated"),
          status: "error",
        });
        return;
      }

      // check java validity and update config
      ConfigService.validateJava(newJavaPath).then((response) => {
        if (response.status !== "success") {
          toast({
            title: t("JavaSettingsPage.toast.addFailed.title"),
            description: t("JavaSettingsPage.toast.addFailed.invalid"),
            status: "error",
          });
          return;
        } else {
          update("extraJavaPaths", [...config.extraJavaPaths, newJavaPath]);
          setJavaInfos(getJavaInfos(true) || []);
          toast({
            title: t("JavaSettingsPage.toast.addSuccess.title"),
            description: t("JavaSettingsPage.toast.addSuccess.description"),
            status: "success",
          });
        }
      });
    }
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

  const javaSecMenuOperations = [
    {
      icon: "download",
      label: t("JavaSettingsPage.javaList.download"),
      onClick: () => onDownloadJavaModalOpen(),
    },
    {
      icon: "add",
      label: t("JavaSettingsPage.javaList.add"),
      onClick: (event: React.MouseEvent) => handleAddJavaPath(event.altKey),
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
      <ManualAddJavaPathModal
        isOpen={isManualAddJavaPathModalOpen}
        onClose={onManualAddJavaPathModalClose}
        onSubmitCallback={onSubmitCallback ?? undefined}
      />
    </>
  );
};

export default JavaSettingsPage;

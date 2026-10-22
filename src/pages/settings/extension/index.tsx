import {
  Alert,
  AlertIcon,
  Avatar,
  AvatarBadge,
  Badge,
  Box,
  HStack,
  Progress,
  Text,
  VStack,
} from "@chakra-ui/react";
import { appDataDir, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useRouter } from "next/router";
import { Trans, useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import {
  LuCircleCheck,
  LuCircleMinus,
  LuClockArrowUp,
  LuX,
} from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem } from "@/components/common/option-item";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { useExtensionHost } from "@/contexts/extension/host";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { ExtensionInfo } from "@/models/extension";
import { ExtensionService } from "@/services/extension";
import { base64ImgSrc } from "@/utils/string";

const ExtensionSettingsPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const { config, update } = useLauncherConfig();
  const { openGenericConfirmDialog, openSharedModal } = useSharedModals();
  const primaryColor = config.appearance.theme.primaryColor;
  const {
    extensionList,
    enabledExtensionList,
    getExtensionList,
    getExtensionSettingsPage,
    handleAddExtension,
    extensionUpdateState,
    handleUpdateExtensions,
    cancelExtensionUpdate,
    resetExtensionUpdateState,
  } = useExtensionHost();
  const extensions = extensionList || [];

  const handleBrowse = async () => {
    const selectedPath = await open({
      multiple: false,
      filters: [
        {
          name: "SJMCL Extension Package",
          extensions: ["sjmclx", "zip"],
        },
      ],
    });
    if (!selectedPath || Array.isArray(selectedPath)) return;
    await handleAddExtension(selectedPath);
  };

  const handleOpenExtensionsFolder = async () => {
    const base = await appDataDir();
    const extensionsDir = await join(base, "UserContent", "Extensions");
    await openPath(extensionsDir);
  };

  const setExtensionEnabled = (identifier: string, enable: boolean) => {
    const enabledSet = new Set(config.extension.enabled);
    if (enable) enabledSet.add(identifier);
    else enabledSet.delete(identifier);
    update("extension.enabled", Array.from(enabledSet));
  };

  const handleToggleExtension = async (
    extension: ExtensionInfo,
    enable: boolean
  ) => {
    if (!enable) {
      setExtensionEnabled(extension.identifier, false);
      return;
    }
    openGenericConfirmDialog({
      title: t("EnableExtensionConfirmDialog.title"),
      body: (
        <Text>
          <Trans
            i18nKey="EnableExtensionConfirmDialog.body"
            values={{
              author:
                extension.author ||
                t("EnableExtensionConfirmDialog.unknownDeveloper"),
              name: extension.name,
              identifier: extension.identifier,
            }}
            components={{
              hl: (
                <Text
                  as="span"
                  color={`${primaryColor}.500`}
                  fontWeight="500"
                />
              ),
            }}
          />
          {t("ExtensionSettingsPage.alert")}
        </Text>
      ),
      btnOK: t("EnableExtensionConfirmDialog.button.enable"),
      onOKCallback: () => setExtensionEnabled(extension.identifier, true),
    });
  };

  const handleDeleteExtension = async (identifier: string) => {
    const response = await ExtensionService.deleteExtension(identifier);
    if (response.status === "success") {
      toast({
        title: response.message,
        status: "success",
      });
      getExtensionList(true);
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
    }
  };

  const isUpdating = extensionUpdateState.running;
  const secMenu: {
    icon: string | IconType;
    label?: string;
    onClick: () => void;
    isDisabled?: boolean;
  }[] = [
    {
      icon: "openFolder",
      onClick: handleOpenExtensionsFolder,
    },
    {
      icon: "add",
      onClick: handleBrowse,
    },
    {
      icon: "refresh",
      // clearing the previous update report before refreshing keeps the UI tidy
      onClick: () => {
        resetExtensionUpdateState();
        getExtensionList(true);
      },
    },
    {
      icon: isUpdating ? LuX : LuClockArrowUp,
      label: t(
        isUpdating
          ? "ExtensionSettingsPage.update.cancel"
          : "ExtensionSettingsPage.update.action"
      ),
      onClick: isUpdating ? cancelExtensionUpdate : handleUpdateExtensions,
      isDisabled: !isUpdating && extensions.length === 0,
    },
  ];

  const enabledSet = new Set(
    enabledExtensionList?.map((extension) => extension.identifier) ||
      config.extension.enabled
  );

  const extensionItemMenuOperations = (extension: ExtensionInfo) => {
    const isEnabled = enabledSet.has(extension.identifier);
    return [
      ...(getExtensionSettingsPage(extension.identifier)
        ? [
            {
              icon: "settings",
              danger: false,
              onClick: () => {
                router.push(`/settings/extension/${extension.identifier}`);
              },
            },
          ]
        : []),
      {
        label: t(isEnabled ? "General.disable" : "General.enable"),
        icon: isEnabled ? LuCircleMinus : LuCircleCheck,
        danger: false,
        onClick: () => {
          handleToggleExtension(extension, !isEnabled);
        },
      },
      {
        icon: "revealFile",
        danger: false,
        onClick: () => {
          revealItemInDir(extension.path);
        },
      },
      {
        label: t("ExtensionSettingsPage.menu.info"),
        icon: "info",
        danger: false,
        onClick: () => {
          openSharedModal("extension-info", { extension });
        },
      },
      {
        icon: "delete",
        danger: true,
        onClick: () => handleDeleteExtension(extension.identifier),
      },
    ];
  };

  const extensionItems: OptionItemGroupProps["items"] = extensions.map(
    (extension: ExtensionInfo) => (
      <OptionItem
        key={extension.identifier}
        title={extension.name}
        titleExtra={
          <Text fontSize="xs" className="secondary-text ellipsis-text">
            {[extension.identifier, extension.version]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        }
        description={extension.description}
        childrenOnHover
        titleLineWrap={false}
        maxTitleLines={1}
        maxDescriptionLines={1}
        prefixElement={
          <Avatar
            boxSize="28px"
            borderRadius="4px"
            src={base64ImgSrc(extension.iconSrc)}
            name={extension.name}
            style={{
              filter: enabledSet.has(extension.identifier)
                ? "none"
                : "grayscale(90%)",
              opacity: enabledSet.has(extension.identifier) ? 1 : 0.5,
            }}
          >
            <AvatarBadge
              bg={enabledSet.has(extension.identifier) ? "green" : "black"}
              boxSize="0.75em"
              borderWidth={2}
            />
          </Avatar>
        }
      >
        <HStack spacing={0}>
          {extensionItemMenuOperations(extension).map((item, index) => (
            <CommonIconButton
              key={index}
              icon={item.icon}
              label={item.label}
              colorScheme={item.danger ? "red" : "gray"}
              onClick={item.onClick}
            />
          ))}
        </HStack>
      </OptionItem>
    )
  );

  const extensionDocItems: OptionItemGroupProps["items"] = [
    {
      title: t("ExtensionSettingsPage.top.settings.extensionDocs.title"),
      description: t(
        "ExtensionSettingsPage.top.settings.extensionDocs.description"
      ),
      children: (
        <CommonIconButton
          label={t("ExtensionSettingsPage.top.settings.extensionDocs.url")}
          icon="external"
          withTooltip
          tooltipPlacement="bottom-end"
          size="xs"
          h={18}
          onClick={() =>
            openUrl(t("ExtensionSettingsPage.top.settings.extensionDocs.url"))
          }
        />
      ),
    },
    {
      title: t("ExtensionSettingsPage.top.settings.awesomeExtensions.title"),
      description: t(
        "ExtensionSettingsPage.top.settings.awesomeExtensions.description"
      ),
      children: (
        <CommonIconButton
          label={t("ExtensionSettingsPage.top.settings.awesomeExtensions.url")}
          icon="external"
          withTooltip
          tooltipPlacement="bottom-end"
          size="xs"
          h={18}
          onClick={() =>
            openUrl(
              t("ExtensionSettingsPage.top.settings.awesomeExtensions.url")
            )
          }
        />
      ),
    },
  ];

  const updateFailures = extensionUpdateState.items.filter(
    (item) => item.status === "failed"
  );
  const currentUpdateItem = extensionUpdateState.items.find(
    (item) => item.status === "downloading" || item.status === "installing"
  );
  const counts = {
    updated: extensionUpdateState.items.filter((i) => i.status === "updated")
      .length,
    upToDate: extensionUpdateState.items.filter((i) => i.status === "upToDate")
      .length,
    skipped: extensionUpdateState.items.filter((i) => i.status === "skipped")
      .length,
    failed: updateFailures.length,
  };
  const updateMessage =
    extensionUpdateState.phase === "checking"
      ? t("ExtensionSettingsPage.update.checking", {
          current: extensionUpdateState.current,
          total: extensionUpdateState.total,
        })
      : extensionUpdateState.phase === "updating"
        ? t(
            `ExtensionSettingsPage.update.${currentUpdateItem?.status === "installing" ? "installing" : "downloading"}`,
            {
              name: currentUpdateItem?.name || "",
              current: extensionUpdateState.current,
              total: extensionUpdateState.total,
            }
          )
        : t("ExtensionSettingsPage.update.completed", counts);
  const updateStartedTime = extensionUpdateState.startedAt
    ? new Date(extensionUpdateState.startedAt).toLocaleTimeString()
    : undefined;

  return (
    <>
      <Section
        title={t("SettingsLayout.settingsDomainList.extension")}
        titleExtra={<Badge colorScheme="purple">Beta</Badge>}
        isAccordion
      >
        <OptionItemGroup items={extensionDocItems} />
      </Section>
      <Section
        title={t("ExtensionSettingsPage.installed")}
        titleExtra={<CountTag count={extensions.length} />}
        isAccordion
        headExtra={
          <HStack spacing={2}>
            {secMenu.map((btn, index) => (
              <CommonIconButton
                key={index}
                icon={btn.icon}
                label={btn.label}
                onClick={btn.onClick}
                size="xs"
                fontSize="sm"
                h={21}
                isDisabled={btn.isDisabled}
              />
            ))}
          </HStack>
        }
      >
        <Alert status="warning" fontSize="xs-sm" borderRadius="md" mb={3}>
          <AlertIcon />
          {t("ExtensionSettingsPage.alert")}
        </Alert>
        {extensionUpdateState.phase !== "idle" && (
          <Alert
            status={
              extensionUpdateState.running
                ? "info"
                : updateFailures.length > 0
                  ? "error"
                  : "success"
            }
            fontSize="xs-sm"
            borderRadius="md"
            mb={3}
            alignItems="flex-start"
          >
            <AlertIcon mt={0.5} />
            <Box flex={1} minW={0}>
              <HStack justify="space-between" align="flex-start" spacing={2}>
                <Text fontWeight="bold" wordBreak="break-word">
                  {updateMessage}
                </Text>
                {updateStartedTime && (
                  <Text
                    color="gray.500"
                    fontSize="xs"
                    whiteSpace="nowrap"
                    flexShrink={0}
                  >
                    {updateStartedTime}
                  </Text>
                )}
              </HStack>
              {extensionUpdateState.running && (
                <Progress
                  value={extensionUpdateState.progress}
                  size="xs"
                  colorScheme={primaryColor}
                  borderRadius="md"
                  mt={2}
                />
              )}
              {updateFailures.length > 0 && (
                <VStack align="stretch" spacing={1} mt={2}>
                  {updateFailures.map((item) => (
                    <HStack
                      key={item.identifier}
                      align="flex-start"
                      spacing={2}
                    >
                      <Text fontWeight="bold" fontSize="xs" flexShrink={0}>
                        {item.name}
                      </Text>
                      <Text fontSize="xs" color="gray.600">
                        {item.failureMessage}
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              )}
            </Box>
          </Alert>
        )}
        {extensions.length > 0 ? (
          <OptionItemGroup items={extensionItems} />
        ) : (
          <Empty withIcon={false} size="sm" />
        )}
      </Section>
    </>
  );
};

export default ExtensionSettingsPage;

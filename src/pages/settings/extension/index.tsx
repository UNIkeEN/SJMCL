import {
  Alert,
  AlertIcon,
  Avatar,
  AvatarBadge,
  Badge,
  CloseButton,
  HStack,
  Text,
} from "@chakra-ui/react";
import { appDataDir, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { LuCircleCheck, LuCircleMinus } from "react-icons/lu";
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
import { useToast } from "@/contexts/toast";
import { ExtensionInfo } from "@/models/extension";
import { ExtensionService } from "@/services/extension";
import { base64ImgSrc } from "@/utils/string";

const ExtensionSettingsPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const { config, update } = useLauncherConfig();
  const {
    extensionList,
    enabledExtensionList,
    getExtensionList,
    getExtensionSettingsPage,
  } = useExtensionHost();
  const extensions = extensionList || [];

  const handleOpenExtensionsFolder = async () => {
    const base = await appDataDir();
    const extensionsDir = await join(base, "UserContent", "Extensions");
    await openPath(extensionsDir);
  };

  const handleAddExtension = async () => {
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

    const response = await ExtensionService.addExtension(selectedPath);
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

  const handleToggleExtension = async (identifier: string, enable: boolean) => {
    const enabledSet = new Set(config.extension.enabled);
    if (enable) enabledSet.add(identifier);
    else enabledSet.delete(identifier);
    update("extension.enabled", Array.from(enabledSet));
  };

  const handleDeleteExtension = async (identifier: string) => {
    const response = await ExtensionService.deleteExtension(identifier);
    if (response.status === "success") {
      update(
        "extension.enabled",
        config.extension.enabled.filter((id) => id !== identifier)
      );
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

  const secMenu = [
    {
      icon: "openFolder",
      onClick: handleOpenExtensionsFolder,
    },
    {
      icon: "add",
      onClick: handleAddExtension,
    },
    {
      icon: "refresh",
      onClick: () => getExtensionList(true),
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
          handleToggleExtension(extension.identifier, !isEnabled);
        },
      },
      {
        icon: "delete",
        danger: true,
        onClick: () => {
          handleDeleteExtension(extension.identifier);
        },
      },
    ];
  };

  const extensionItems: OptionItemGroupProps["items"] = extensions.map(
    (extension: ExtensionInfo) => (
      <OptionItem
        key={extension.identifier}
        title={extension.name}
        titleExtra={
          <Text fontSize="xs" className="secondary-text">
            {[extension.identifier, extension.version]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        }
        description={extension.description}
        childrenOnHover
        titleLineWrap={false}
        maxTitleLines={1}
        maxDescriptionLines={2}
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
                onClick={btn.onClick}
                size="xs"
                fontSize="sm"
                h={21}
              />
            ))}
          </HStack>
        }
      >
        {!config.states.extensionSettingsPage.hideAlert && (
          <Alert status="warning" fontSize="xs-sm" borderRadius="md" mb={3}>
            <AlertIcon />
            {t("ExtensionSettingsPage.alert")}
            <CloseButton
              alignSelf="flex-start"
              position="relative"
              right={-2}
              size="sm"
              onClick={() =>
                update("states.extensionSettingsPage.hideAlert", true)
              }
            />
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

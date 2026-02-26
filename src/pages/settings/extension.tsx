import { Avatar, AvatarBadge, HStack, Text } from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-dialog";
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
import { useExtensionHost } from "@/contexts/extension";
import { useToast } from "@/contexts/toast";
import { ExtensionInfo } from "@/models/extension";
import { ExtensionService } from "@/services/extension";
import { base64ImgSrc } from "@/utils/string";

const ExtensionSettingsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config, update } = useLauncherConfig();
  const { extensionList, enabledExtensionList, getExtensionList } =
    useExtensionHost();
  const extensions = extensionList || getExtensionList() || [];

  const handleAddExtension = async () => {
    const selectedPath = await open({
      multiple: false,
      filters: [
        {
          name: "SJMCL Extension Package",
          extensions: ["sjmclx"],
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
            {extension.identifier}
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

  return (
    <Section
      title={t("SettingsLayout.settingsDomainList.extension")}
      titleExtra={<CountTag count={extensions.length} />}
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
      {extensions.length > 0 ? (
        <OptionItemGroup items={extensionItems} />
      ) : (
        <Empty withIcon={false} size="sm" />
      )}
    </Section>
  );
};

export default ExtensionSettingsPage;

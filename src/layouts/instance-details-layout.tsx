import { Button, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { openPath } from "@tauri-apps/plugin-opener";
import { useRouter } from "next/router";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import { FaRegStar, FaStar } from "react-icons/fa6";
import {
  LuBookDashed,
  LuEarth,
  LuFullscreen,
  LuHaze,
  LuHouse,
  LuPackage,
  LuPackagePlus,
  LuPlay,
  LuSettings,
  LuSquareLibrary,
  LuSquarePlus,
} from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import NavMenu from "@/components/common/nav-menu";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import {
  InstanceContextProvider,
  useInstanceSharedData,
} from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { InstanceService } from "@/services/instance";

const InstanceDetailsLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <InstanceContextProvider>
      <InstanceDetailsLayoutContent>{children}</InstanceDetailsLayoutContent>
    </InstanceContextProvider>
  );
};

const InstanceDetailsLayoutContent: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const router = useRouter();
  const toast = useToast();
  const { t } = useTranslation();
  const { openSharedModal, openGenericConfirmDialog, closeSharedModal } =
    useSharedModals();
  const { id } = router.query;
  const instanceId = Array.isArray(id) ? id[0] : id;

  const { summary, handleUpdateInstanceConfig } = useInstanceSharedData();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const navBarType = config.general.functionality.instancesNavType;

  const handleCreateLaunchDesktopShortcut = useCallback(
    (instanceId: string) => {
      if (!instanceId || !summary) return;

      const colonIndex = instanceId.indexOf(":");
      const nameFromRouter =
        colonIndex !== -1 ? instanceId.slice(colonIndex + 1) : instanceId;

      if (nameFromRouter && summary.name && nameFromRouter !== summary.name) {
        openGenericConfirmDialog({
          title: t("General.notice"),
          body: t("CreateRenamedInstShortcutAlertDialog.content"),
          btnCancel: "",
          onOKCallback: () => {
            closeSharedModal("generic-confirm");
          },
        });
        return;
      }

      InstanceService.createLaunchDesktopShortcut(instanceId).then(
        (response) => {
          if (response.status === "success") {
            toast({
              title: response.message,
              status: "success",
            });
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        }
      );
    },
    [summary, toast, closeSharedModal, openGenericConfirmDialog, t]
  );

  const instanceSecMenuOperations = [
    {
      icon: "openFolder",
      danger: false,
      onClick: () => {
        openPath(summary?.versionPath || "");
      },
    },
    {
      icon: LuSquarePlus,
      label: t("InstanceDetailsLayout.secMenu.createShortcut"),
      danger: false,
      onClick: () => {
        if (instanceId) handleCreateLaunchDesktopShortcut(instanceId);
      },
    },
    {
      icon: LuPackagePlus,
      label: t("InstanceDetailsLayout.secMenu.exportModPack"),
      danger: false,
      onClick: () => {},
    },
    {
      icon: "delete",
      label: t("InstanceMenu.label.delete"),
      danger: true,
      onClick: () => {
        if (summary)
          openSharedModal("delete-instance-alert", { instance: summary });
      },
    },
  ];

  const instanceTabList: { key: string; icon: IconType }[] = [
    { key: "overview", icon: LuHouse },
    { key: "worlds", icon: LuEarth },
    { key: "mods", icon: LuSquareLibrary },
    { key: "resourcepacks", icon: LuPackage },
    { key: "schematics", icon: LuBookDashed },
    { key: "shaderpacks", icon: LuHaze },
    { key: "screenshots", icon: LuFullscreen },
    { key: "settings", icon: LuSettings },
  ];

  return (
    <Section
      display="flex"
      flexDirection="column"
      height="100%"
      title={summary?.name}
      withBackButton={navBarType !== "instance"}
      backRoutePath="/instances/list"
      titleExtra={
        <CommonIconButton
          icon={summary?.starred ? FaStar : FaRegStar}
          label={t(
            `InstanceDetailsLayout.secMenu.${summary?.starred ? "unstar" : "star"}`
          )}
          color={summary?.starred ? "yellow.500" : "inherit"}
          onClick={() => {
            handleUpdateInstanceConfig("starred", !summary?.starred);
          }}
          size="xs"
          fontSize="sm"
          h={21}
          marginInlineEnd="0.5rem"
        />
      }
      headExtra={
        <HStack spacing={2}>
          {instanceSecMenuOperations.map((btn, index) => (
            <CommonIconButton
              key={index}
              icon={btn.icon}
              label={btn.label}
              colorScheme={btn.danger ? "red" : "gray"}
              onClick={btn.onClick}
              size="xs"
              fontSize="sm"
              h={21}
            />
          ))}
          <Button
            leftIcon={<LuPlay />}
            size="xs"
            ml={1}
            colorScheme={primaryColor}
            onClick={() => {
              openSharedModal("launch", { instanceId: summary?.id });
            }}
          >
            {t("InstanceDetailsLayout.button.launch")}
          </Button>
        </HStack>
      }
      maxTitleLines={1}
    >
      <NavMenu
        flexWrap="wrap"
        selectedKeys={[router.asPath]}
        onClick={(value) => router.push(value)}
        direction="row"
        size="xs"
        mb={4}
        spacing={
          config.general.general.language.startsWith("zh") ? "0.05rem" : 0.5
        }
        items={instanceTabList.map((item) => ({
          value: `/instances/details/${encodeURIComponent(instanceId || "")}/${item.key}`,
          label: (
            <HStack spacing={1.5}>
              <Icon as={item.icon} />
              <Text fontSize="sm">
                {t(`InstanceDetailsLayout.instanceTabList.${item.key}`)}
              </Text>
            </HStack>
          ),
        }))}
      />
      <VStack
        overflow="auto"
        align="stretch"
        spacing={4}
        flex="1"
        key={router.asPath}
      >
        {children}
      </VStack>
    </Section>
  );
};

export default InstanceDetailsLayout;

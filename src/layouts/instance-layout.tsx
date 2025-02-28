import { Button, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import {
  LuBookDashed,
  LuEarth,
  LuFullscreen,
  LuHaze,
  LuHouse,
  LuPackage,
  LuPlay,
  LuSettings,
  LuSquareLibrary,
} from "react-icons/lu";
import { LuPackagePlus } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import NavMenu from "@/components/common/nav-menu";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import {
  InstanceContextProvider,
  useInstanceSharedData,
} from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";

const InstanceLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <InstanceContextProvider>
      <InstanceLayoutContent>{children}</InstanceLayoutContent>
    </InstanceContextProvider>
  );
};

const InstanceLayoutContent: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { openSharedModal } = useSharedModals();

  const { summary } = useInstanceSharedData();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const instanceSecMenuOperations = [
    {
      icon: "openFolder",
      danger: false,
      onClick: () => {
        open(summary?.versionPath || "");
      },
    },
    {
      icon: LuPackagePlus,
      label: t("InstanceLayout.secMenu.exportModPack"),
      danger: false,
      onClick: () => {},
    },
    {
      icon: "delete",
      label: t("GameMenu.label.delete"),
      danger: true,
      onClick: () => {
        if (summary)
          openSharedModal("delete-game-instance-alert", { game: summary });
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
            onClick={() => {}} // todo
          >
            {t("InstanceLayout.button.launch")}
          </Button>
        </HStack>
      }
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
          value: `/games/instance/${router.query.id}/${item.key}`,
          label: (
            <HStack spacing={1.5}>
              <Icon as={item.icon} />
              <Text fontSize="sm">
                {t(`InstanceLayout.instanceTabList.${item.key}`)}
              </Text>
            </HStack>
          ),
        }))}
      />
      <VStack overflow="auto" align="strench" spacing={4} flex="1">
        {children}
      </VStack>
    </Section>
  );
};

export default InstanceLayout;

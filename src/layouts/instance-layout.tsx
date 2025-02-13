import { Button, Flex, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/router";
import React, { useContext } from "react";
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
import NavMenu from "@/components/common/nav-menu";
import { useLauncherConfig } from "@/contexts/config";
import {
  InstanceContextProvider,
  useInstanceSharedData,
} from "@/contexts/instance";

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

  const { summary } = useInstanceSharedData();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const instanceTabList: { key: string; icon: IconType }[] = [
    { key: "overview", icon: LuHouse },
    { key: "worlds", icon: LuEarth },
    { key: "mods", icon: LuSquareLibrary },
    { key: "resourcepacks", icon: LuPackage },
    ...(summary?.hasSchemFolder
      ? [{ key: "schematics", icon: LuBookDashed }]
      : []),
    { key: "shaderpacks", icon: LuHaze },
    { key: "screenshots", icon: LuFullscreen },
    { key: "settings", icon: LuSettings },
  ];

  return (
    <VStack align="strench" h="100%" spacing={4}>
      <Flex alignItems="flex-start">
        <Text fontWeight="bold" fontSize="sm">
          {summary?.name}
        </Text>
        <Button
          leftIcon={<LuPlay />}
          size="xs"
          ml="auto"
          colorScheme={primaryColor}
          onClick={() => {}} // todo
        >
          {t("InstanceLayout.button.launch")}
        </Button>
      </Flex>
      <NavMenu
        flexWrap="wrap"
        selectedKeys={[router.asPath]}
        onClick={(value) => router.push(value)}
        direction="row"
        size="xs"
        spacing={
          config.general.general.language.startsWith("zh") &&
          summary?.hasSchemFolder
            ? "0.05rem"
            : 1
        }
        mt={-1.5}
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
    </VStack>
  );
};

export default InstanceLayout;

import {
  Flex,
  HStack,
  Icon,
  IconButton,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuFolder, LuFolderOpen, LuPlus, LuTrash } from "react-icons/lu";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import GlobalGameSettings from "@/components/global-game-settings";
import { useLauncherConfig } from "@/contexts/config";

const GlobalGameSettingsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();

  const directorySettings: OptionItemGroupProps[] = [
    {
      title: t("GlobalGameSettingsPage.directories.title"),
      items: [
        {
          title: t(
            "GlobalGameSettingsPage.directories.settings.directories.title"
          ),
          children: (
            <Tooltip
              label={t(
                "GlobalGameSettingsPage.directories.settings.directories.add"
              )}
              placement="top"
            >
              <IconButton // TBD
                aria-label="add"
                variant="ghost"
                size="xs"
                icon={<Icon as={LuPlus} boxSize={3.5} />}
                h={21}
              />
            </Tooltip>
          ),
        },
        <VStack key="dir-list" ml={1.5} spacing={0.5}>
          {config.localGameDirectories.map((dir) => (
            <Flex key={dir} alignItems="center" w="100%">
              <HStack>
                <LuFolder size={12} />
                <Text fontSize="xs" className="secondary-text">
                  {dir}
                </Text>
              </HStack>
              <HStack spacing={1} ml="auto">
                <Tooltip label={t("General.openFolder")}>
                  <IconButton // TBD
                    aria-label="openFolder"
                    variant="ghost"
                    size="xs"
                    icon={<LuFolderOpen />}
                    h={21}
                  />
                </Tooltip>
                <Tooltip label={t("General.delete")}>
                  <IconButton // TBD
                    aria-label="openFolder"
                    variant="ghost"
                    size="xs"
                    icon={<LuTrash />}
                    h={21}
                    colorScheme="red"
                  />
                </Tooltip>
              </HStack>
            </Flex>
          ))}
        </VStack>,
      ],
    },
  ];

  return (
    <>
      {directorySettings.map((group, index) => (
        <OptionItemGroup {...group} key={index} />
      ))}
      <GlobalGameSettings />
    </>
  );
};

export default GlobalGameSettingsPage;

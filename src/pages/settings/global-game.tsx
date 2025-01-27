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
import GameSettingsGroups from "@/components/game-settings-groups";
import { useLauncherConfig } from "@/contexts/config";

const GlobalGameSettingsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();

  const globalSpecSettingsGroups: OptionItemGroupProps[] = [
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
          {config.localGameDirectories.map((directory, index) => (
            <Flex key={index} alignItems="center" w="100%">
              <HStack overflow="hidden" mr={2}>
                <LuFolder size={12} />
                <Text fontSize="xs" className="ellipsis-text" flex={1}>
                  <span>
                    {directory.name === "CURRENT_DIR"
                      ? t(
                          "GlobalGameSettingsPage.directories.settings.directories.currentDir"
                        )
                      : directory.name}
                  </span>
                  <span className="secondary-text">&ensp;{directory.dir}</span>
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
      {globalSpecSettingsGroups.map((group, index) => (
        <OptionItemGroup {...group} key={index} />
      ))}
      <GameSettingsGroups />
    </>
  );
};

export default GlobalGameSettingsPage;

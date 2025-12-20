// This component is used in the create-instance modal, instead of instance settings page.
import { Box, HStack, Image, Radio, VStack } from "@chakra-ui/react";
import { t } from "i18next";
import { useEffect } from "react";
import Editable from "@/components/common/editable";
import {
  OptionItemGroup,
  OptionItemGroupProps,
  OptionItemProps,
} from "@/components/common/option-item";
import { InstanceIconSelectorPopover } from "@/components/instance-icon-selector";
import { useLauncherConfig } from "@/contexts/config";
import { GameDirectory } from "@/models/config";
import { getGameDirName } from "@/utils/instance";
import { isFileNameSanitized } from "@/utils/string";

interface InstanceBasicSettingsProps {
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (description: string) => void;
  iconSrc: string;
  setIconSrc: (iconSrc: string) => void;
  gameDirectory: GameDirectory | undefined;
  setGameDirectory: (directory: GameDirectory) => void;
}

export const InstanceBasicSettings: React.FC<InstanceBasicSettingsProps> = ({
  name,
  setName,
  description,
  setDescription,
  iconSrc,
  setIconSrc,
  gameDirectory,
  setGameDirectory,
}) => {
  const { config } = useLauncherConfig();

  useEffect(() => {
    if (config.localGameDirectories.length > 0) {
      setGameDirectory(config.localGameDirectories[0]);
    }
  }, [config, setGameDirectory]);

  const checkDirNameError = (value: string): number => {
    if (value.trim() === "") return 1;
    if (!isFileNameSanitized(value)) return 2;
    if (value.length > 255) return 3;
    return 0;
  };

  const instanceSpecSettingsGroups: OptionItemGroupProps[] = [
    {
      items: [
        {
          title: t("InstanceSettingsPage.name"),
          children: (
            <Editable
              isTextArea={false}
              value={name}
              onEditSubmit={setName}
              textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
              inputProps={{ fontSize: "xs-sm" }}
              formErrMsgProps={{ fontSize: "xs-sm" }}
              checkError={checkDirNameError}
              localeKey="InstanceSettingsPage.errorMessage"
            />
          ),
        },
        {
          title: t("InstanceSettingsPage.description"),
          children: (
            <Editable
              isTextArea={true}
              value={description}
              onEditSubmit={setDescription}
              textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
              inputProps={{ fontSize: "xs-sm" }}
            />
          ),
        },
        {
          title: t("InstanceSettingsPage.icon"),
          children: (
            <HStack>
              <Image
                src={iconSrc}
                alt={iconSrc}
                boxSize="28px"
                objectFit="cover"
              />
              <InstanceIconSelectorPopover
                value={iconSrc}
                onIconSelect={setIconSrc}
              />
            </HStack>
          ),
        },
      ],
    },
    {
      title: t("InstanceBasicSettings.selectDirectory"),
      items: [
        ...config.localGameDirectories.map(
          (directory): OptionItemProps => ({
            title: getGameDirName(directory),
            description: directory.dir,
            prefixElement: (
              <Radio isChecked={directory.dir === gameDirectory?.dir} />
            ),
            children: <></>,
            isFullClickZone: true,
            onClick: () => {
              setGameDirectory(directory);
            },
          })
        ),
      ],
    },
  ];

  return (
    <Box h="100%" w="100%" overflowX="hidden" overflowY="auto">
      <VStack w="100%" spacing={4}>
        {instanceSpecSettingsGroups.map((group, index) => (
          <OptionItemGroup
            title={group.title}
            items={group.items}
            key={index}
            w="100%"
          />
        ))}
      </VStack>
    </Box>
  );
};

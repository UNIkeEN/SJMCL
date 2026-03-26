import {
  Button,
  Center,
  Divider,
  HStack,
  Icon,
  IconButton,
  Image,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Portal,
  StackProps,
  Text,
  VStack,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCirclePlus, LuPenLine } from "react-icons/lu";
import SelectableButton from "@/components/common/selectable-button";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { InstanceService } from "@/services/instance";
import { getInstanceIconSrc } from "@/utils/instance";

interface InstanceIconSelectorProps extends StackProps {
  value?: string;
  onIconSelect: (value: string) => void;
  // if provided instanceId and versionPath, support uploading for customization
  instanceId?: string;
  versionPath?: string;
}

/**
 * If image fails to load, hide the WHOLE selectable item so it doesn't occupy space.
 * refreshKey changes => reset ok=true (so custom icon can reappear after upload)
 */
const IconSelectableButton: React.FC<{
  src: string;
  selectedValue?: string;
  onSelect: (v: string) => void;
  versionPath: string;
  refreshKey?: number;
}> = ({ src, selectedValue, onSelect, versionPath, refreshKey }) => {
  const [ok, setOk] = useState(true);

  useEffect(() => {
    setOk(true);
  }, [refreshKey]);

  if (!ok) return null;

  return (
    <SelectableButton
      value={src}
      isSelected={src === selectedValue}
      onClick={() => onSelect(src)}
      paddingX={0.5}
    >
      <Center w="100%">
        <Image
          src={getInstanceIconSrc(src, versionPath)}
          alt={src}
          boxSize="24px"
          onError={() => setOk(false)}
        />
      </Center>
    </SelectableButton>
  );
};

export const InstanceIconSelector: React.FC<InstanceIconSelectorProps> = ({
  value,
  onIconSelect,
  instanceId,
  versionPath = "",
  ...stackProps
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [customIconRefreshKey, setCustomIconRefreshKey] = useState(0);

  const handleAddCustomIcon = () => {
    if (!instanceId) return;

    open({
      multiple: false,
      filters: [
        {
          name: t("General.dialog.filterName.image"),
          extensions: ["jpg", "jpeg", "png", "gif", "webp"],
        },
      ],
    })
      .then((selectedPath) => {
        if (!selectedPath) return;
        if (Array.isArray(selectedPath)) return;

        InstanceService.addCustomInstanceIcon(instanceId, selectedPath).then(
          (response) => {
            if (response.status === "success") {
              // select custom icon immediately
              onIconSelect("custom");
              // refresh the "custom" icon button in case it was hidden by onError previously
              setCustomIconRefreshKey((v) => v + 1);
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
      })
      .catch(() => {});
  };

  const itemRows: Array<Array<string | React.ReactNode>> = [
    [
      "/images/icons/JEIcon_Release.png",
      "/images/icons/JEIcon_Snapshot.png",
      <Divider orientation="vertical" key="d1" />,
      "/images/icons/CommandBlock.png",
      "/images/icons/CraftingTable.png",
      "/images/icons/GrassBlock.png",
      "/images/icons/StoneOldBeta.png",
      "/images/icons/YellowGlazedTerracotta.png",
    ],
    [
      "/images/icons/Fabric.png",
      "/images/icons/Anvil.png",
      "/images/icons/NeoForge.png",
      "/images/icons/OptiFine.png",
      ...(instanceId
        ? [
            <Divider orientation="vertical" key="d2" />,
            "custom", // will be converted by `getInstanceIconSrc()`
            <Button
              key="add-btn"
              size="xs"
              variant="ghost"
              colorScheme={primaryColor}
              onClick={handleAddCustomIcon}
            >
              <HStack spacing={1.5}>
                <Icon as={LuCirclePlus} />
                <Text>{t("InstanceIconSelector.customize")}</Text>
              </HStack>
            </Button>,
          ]
        : []),
    ],
  ];

  return (
    <VStack spacing={1} align="stretch" {...stackProps}>
      {itemRows.map((row, rowIndex) => (
        <HStack key={rowIndex} h="32px">
          {row.map((item, index) =>
            typeof item === "string" ? (
              <IconSelectableButton
                key={`i-${rowIndex}-${index}`}
                src={item}
                selectedValue={value}
                onSelect={onIconSelect}
                versionPath={versionPath}
                refreshKey={item === "custom" ? customIconRefreshKey : 0}
              />
            ) : (
              item
            )
          )}
        </HStack>
      ))}
    </VStack>
  );
};

export const InstanceIconSelectorPopover: React.FC<
  InstanceIconSelectorProps
> = ({ ...props }) => {
  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <IconButton
          icon={<LuPenLine />}
          size="xs"
          variant="ghost"
          aria-label="edit"
        />
      </PopoverTrigger>
      <Portal>
        <PopoverContent width="auto">
          <PopoverBody>
            <InstanceIconSelector {...props} />
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
};

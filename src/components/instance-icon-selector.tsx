import {
  Center,
  Divider,
  HStack,
  IconButton,
  Image,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  StackProps,
} from "@chakra-ui/react";
import { LuPenLine } from "react-icons/lu";
import SelectableButton from "@/components/common/selectable-button";

interface InstanceIconSelectorProps extends StackProps {
  value?: string;
  onIconSelect: (value: string) => void;
}

export const InstanceIconSelector: React.FC<InstanceIconSelectorProps> = ({
  value,
  onIconSelect,
  ...stackProps
}) => {
  const iconList = [
    "/images/icons/JEIcon_Release.png",
    "/images/icons/JEIcon_Snapshot.png",
    "divider",
    "/images/icons/CommandBlock.png",
    "/images/icons/CraftingTable.png",
    "/images/icons/GrassBlock.png",
    "/images/icons/StoneOldBeta.png",
    "/images/icons/YellowGlazedTerracotta.png",
    "divider",
    "/images/icons/Fabric.png",
    "/images/icons/Anvil.png",
    "/images/icons/NeoForge.png",
  ];

  return (
    <HStack h="32px" {...stackProps}>
      {iconList.map((iconSrc, index) => {
        return iconSrc === "divider" ? (
          <Divider key={index} orientation="vertical" />
        ) : (
          <SelectableButton
            key={index}
            value={iconSrc}
            isSelected={iconSrc === value}
            onClick={() => onIconSelect(iconSrc)}
            paddingX={0.5}
          >
            <Center w="100%">
              <Image
                src={iconSrc}
                alt={iconSrc}
                boxSize="24px"
                objectFit="cover"
              />
            </Center>
          </SelectableButton>
        );
      })}
    </HStack>
  );
};

export const InstanceIconSelectorPopover: React.FC<
  InstanceIconSelectorProps
> = ({ ...props }) => {
  return (
    <Popover>
      <PopoverTrigger>
        <IconButton
          icon={<LuPenLine />}
          size="xs"
          variant="ghost"
          aria-label="edit"
        />
      </PopoverTrigger>
      <PopoverContent width="auto">
        <PopoverBody>
          <InstanceIconSelector {...props} />
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

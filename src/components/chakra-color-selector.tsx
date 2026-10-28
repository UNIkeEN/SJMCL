import {
  Box,
  BoxProps,
  Flex,
  HStack,
  IconButton,
  Spacer,
  Tooltip,
} from "@chakra-ui/react";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCircleCheck, FaRegCircle } from "react-icons/fa6";
import { LuChevronDown, LuX } from "react-icons/lu";
import { DropdownSurface } from "@/components/common/dropdown-menu";
import { ChakraColorEnums, ColorSelectorType } from "@/enums/misc";

interface ChakraColorSelectorProps extends BoxProps {
  current: string;
  onColorSelect: (color: ColorSelectorType) => void;
  size?: string;
}

const ChakraColorSelector: React.FC<ChakraColorSelectorProps> = ({
  current,
  onColorSelect,
  size = "md",
  ...boxProps
}) => {
  const { t } = useTranslation();

  return (
    <Box w="100%" {...boxProps}>
      <Flex>
        {ChakraColorEnums.map((color: ColorSelectorType, index: number) => (
          <React.Fragment key={color}>
            <Tooltip label={t(`Enums.chakraColors.${color}`)}>
              <IconButton
                size={size}
                variant={current === color ? "solid" : "subtle"}
                colorScheme={color}
                aria-label={color}
                icon={
                  current === color ? (
                    <FaCircleCheck color="white" />
                  ) : (
                    <FaRegCircle />
                  )
                }
                onClick={() => onColorSelect(color)}
              />
            </Tooltip>
            {index < ChakraColorEnums.length - 1 && <Spacer />}
          </React.Fragment>
        ))}
      </Flex>
    </Box>
  );
};

interface ChakraColorSelectPopoverProps {
  current?: string;
  onColorSelect: (color: ColorSelectorType) => void;
  size?: string;
  withUnselectButton?: boolean;
  onUnselect?: () => void;
}

export const ChakraColorSelectPopover: React.FC<
  ChakraColorSelectPopoverProps
> = ({
  current = "",
  onColorSelect,
  size = "xs",
  withUnselectButton = false,
  onUnselect,
}) => {
  const hasSelectedColor = current !== "";
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <Box ref={rootRef} position="relative" display="inline-block">
      <IconButton
        size={size}
        colorScheme={current || "gray"}
        variant={hasSelectedColor ? "solid" : "outline"}
        aria-label="color"
        aria-expanded={open}
        icon={<LuChevronDown />}
        onClick={() => setOpen((o) => !o)}
      />
      <DropdownSurface rootRef={rootRef} open={open} p={2}>
        <HStack spacing={2}>
          <ChakraColorSelector
            current={current}
            onColorSelect={onColorSelect}
            size={size}
            flex={1}
          />
          {withUnselectButton && hasSelectedColor && (
            <IconButton
              size={size}
              colorScheme={current || "gray"}
              variant="outline"
              aria-label="unselect-color"
              icon={<LuX />}
              onClick={onUnselect}
              isDisabled={!onUnselect}
            />
          )}
        </HStack>
      </DropdownSurface>
    </Box>
  );
};

export default ChakraColorSelector;

import {
  Box,
  BoxProps,
  Flex,
  IconButton,
  Spacer,
  Tooltip,
} from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import { FaCircleCheck, FaRegCircle } from "react-icons/fa6";
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

export default ChakraColorSelector;

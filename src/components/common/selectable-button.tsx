import { Button, ButtonProps } from "@chakra-ui/react";
import React from "react";

interface SelectableButtonProps extends ButtonProps {
  isSelected?: boolean;
}

// easy-launcher (docs/design/DESIGN-settings.md): selected = 9% white bg,
// text brightens; monochrome, no accent.
const SelectableButton: React.FC<SelectableButtonProps> = ({
  isSelected = false,
  children,
  ...props
}) => {
  return (
    <Button
      variant="ghost"
      bg={isSelected ? "surface" : "transparent"}
      color={isSelected ? "ink" : "muted"}
      borderRadius="el-sm"
      fontWeight={isSelected ? "600" : "500"}
      textAlign="left"
      justifyContent="flex-start"
      overflow="hidden"
      _hover={{ bg: isSelected ? "surface" : "transparent", color: "ink" }}
      _active={{ bg: "surface" }}
      {...props}
    >
      {children}
    </Button>
  );
};

export default SelectableButton;

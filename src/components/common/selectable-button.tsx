import { Button, ButtonProps } from "@chakra-ui/react";
import React from "react";

interface SelectableButtonProps extends ButtonProps {
  isSelected?: boolean;
}

// easy-launcher (docs/design/DESIGN.md): selected = accent pill with ink border;
// text color is left untouched, matching the head-navbar active-tab behavior.
const SelectableButton: React.FC<SelectableButtonProps> = ({
  isSelected = false,
  children,
  ...props
}) => {
  return (
    <Button
      variant="ghost"
      bg={isSelected ? "accent" : "transparent"}
      color="ink"
      border="2px solid"
      borderColor={isSelected ? "ink" : "transparent"}
      borderRadius="el-sm"
      fontWeight={isSelected ? "600" : "normal"}
      textAlign="left"
      justifyContent="flex-start"
      overflow="hidden"
      _hover={{ bg: isSelected ? "accent" : "surface" }}
      _active={{ bg: "accent" }}
      {...props}
    >
      {children}
    </Button>
  );
};

export default SelectableButton;

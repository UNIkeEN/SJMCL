import {
  Button,
  ButtonProps,
  useColorModeValue,
  useTheme,
} from "@chakra-ui/react";
import React from "react";

interface SelectableButtonProps extends ButtonProps {
  isSelected?: boolean;
  bgColorScheme?: string;
}

const SelectableButton: React.FC<SelectableButtonProps> = ({
  isSelected = false,
  bgColorScheme = "",
  colorScheme = "gray",
  children,
  ...props
}) => {
  const theme = useTheme();

  const _bgColorScheme = useColorModeValue("blackAlpha", "whiteAlpha");
  bgColorScheme = bgColorScheme || _bgColorScheme;

  let selectedBg = theme.colors[bgColorScheme][200];
  const selectedColor = theme.colors[colorScheme][useColorModeValue(900, 100)];
  const defaultColor = theme.colors[colorScheme][useColorModeValue(600, 400)];

  return (
    <Button
      variant="ghost"
      bg={isSelected ? selectedBg : "transparent"}
      color={isSelected ? selectedColor : defaultColor}
      textAlign="left"
      justifyContent="flex-start"
      overflow="hidden"
      _hover={{
        bg: isSelected ? selectedBg : theme.colors[bgColorScheme][100],
      }}
      _active={{
        bg: theme.colors[bgColorScheme][300],
      }}
      {...props}
    >
      {children}
    </Button>
  );
};

export default SelectableButton;

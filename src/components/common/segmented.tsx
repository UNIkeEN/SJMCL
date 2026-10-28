import { Box, BoxProps, Button, Stack, Tooltip } from "@chakra-ui/react";

interface SegmentedControlProps extends BoxProps {
  size?: "2xs" | "xs" | "sm" | "md" | "lg";
  colorScheme?: string;
  items: {
    label: string | React.ReactNode;
    value: string;
    tooltip?: string;
  }[];
  selected: string;
  onSelectItem: (label: string) => void;
  direction?: "row" | "column";
  withTooltip?: boolean;
}

// easy-launcher (docs/design/DESIGN.md): light-only tokens — surface track,
// selected = ground pill with ink border; text color untouched.
const SegmentedControl: React.FC<SegmentedControlProps> = ({
  size = "md",
  colorScheme = "gray",
  items,
  selected,
  onSelectItem,
  direction = "row",
  withTooltip = false,
  ...boxProps
}) => {
  const sp = { "2xs": 0.5, xs: 0.5, sm: "0.175rem", md: 1, lg: 2 }[size];

  return (
    <Box
      bgColor="surface"
      p={sp}
      borderRadius="el-md"
      display="inline-block"
      {...boxProps}
    >
      <Stack direction={direction} spacing={sp}>
        {items.map((item) => {
          const isSelected = selected === item.value;

          const button = (
            <Button
              key={item.value}
              size={size == "2xs" ? "xs" : size}
              {...(size == "2xs" && { h: "1.2rem", w: "1.25rem" })}
              variant="ghost"
              color="ink"
              borderRadius="el-sm"
              bg={isSelected ? "ground" : "transparent"}
              border="2px solid"
              borderColor={isSelected ? "ink" : "transparent"}
              _hover={{ bg: "ground" }}
              _active={{ bg: "ground" }}
              onClick={() => onSelectItem(item.value)}
            >
              {item.label}
            </Button>
          );

          return (
            <Tooltip
              key={item.value}
              label={item.tooltip || item.value}
              isDisabled={!withTooltip}
            >
              {button}
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
};

export default SegmentedControl;

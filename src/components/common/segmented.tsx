import {
  Box,
  BoxProps,
  Button,
  Stack,
  Tooltip,
  useBreakpointValue,
} from "@chakra-ui/react";

interface SegmentedControlProps extends BoxProps {
  size?: "2xs" | "xs" | "sm" | "md" | "lg";
  colorScheme?: string;
  items: {
    label: string;
    value: string | React.ReactNode;
    tooltip?: string;
  }[];
  selected: string;
  onSelectItem: (label: string) => void;
  direction?: "row" | "column";
  withTooltip?: boolean;
}

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
      bgColor={`${colorScheme}.100`}
      p={sp}
      borderRadius="md"
      borderWidth="0.5px"
      borderColor={`${colorScheme}.300`}
      display="inline-block"
      {...boxProps}
    >
      <Stack direction={direction} spacing={sp}>
        {items.map((item) => {
          const isSelected = selected === item.label;

          const button = (
            <Button
              key={item.label}
              size={size == "2xs" ? "xs" : size}
              {...(size == "2xs" && { h: "1.25rem", w: "1.25rem" })}
              colorScheme={colorScheme}
              variant={isSelected ? "outline" : "subtle"}
              bgColor={isSelected ? "white" : `${colorScheme}.100`}
              _hover={
                isSelected ? { bgColor: "white" } : { bg: `${colorScheme}.200` }
              }
              _active={
                isSelected ? { bgColor: "white" } : { bg: `${colorScheme}.300` }
              }
              onClick={() => onSelectItem(item.label)}
            >
              {item.value}
            </Button>
          );

          return (
            <Tooltip
              key={item.label}
              fontSize={size}
              label={item.tooltip || item.label}
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

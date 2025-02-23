import {
  Box,
  BoxProps,
  Button,
  Stack,
  Tooltip,
  useColorModeValue,
} from "@chakra-ui/react";

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

  const palettes = useColorModeValue([100, 200, 300], [900, 800, 700]);
  const coreColor = useColorModeValue("white", "black");

  return (
    <Box
      bgColor={`${colorScheme}.${palettes[0]}`}
      p={sp}
      borderRadius="md"
      borderWidth="0.5px"
      borderColor={`${colorScheme}.${palettes[0]}`}
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
              colorScheme={colorScheme}
              variant={isSelected ? "outline" : "subtle"}
              bgColor={isSelected ? coreColor : `${colorScheme}.${palettes[0]}`}
              _hover={
                isSelected
                  ? { bgColor: coreColor }
                  : { bg: `${colorScheme}.${palettes[1]}` }
              }
              _active={
                isSelected
                  ? { bgColor: coreColor }
                  : { bg: `${colorScheme}.${palettes[2]}` }
              }
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

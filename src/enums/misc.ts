export const ChakraColorEnums = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  // "cyan",  // to close to blue, hide in color-selector
  "purple",
  "pink",
  "gray",
] as const;

export type ColorSelectorType = (typeof ChakraColorEnums)[number];

export const isChakraColor = (value?: string): value is ColorSelectorType => {
  if (!value) return false;
  return ChakraColorEnums.includes(value as ColorSelectorType);
};

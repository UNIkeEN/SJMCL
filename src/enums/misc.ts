export const ChakraColorEnums = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  // "cyan",  // to close to blue, hide in color-selector
  "purple",
  "pink",
] as const;

export type ColorSelectorType = (typeof ChakraColorEnums)[number];

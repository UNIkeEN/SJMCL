import { extendTheme } from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";

// easy-launcher design tokens (docs/design/DESIGN-homebar.md): full monochrome,
// dark-only. Token names kept from the previous theme so existing components
// retheme automatically.
export const elTokens = {
  colors: {
    ground: "#0A0A0A",
    ink: "#FAFAFA",
    accent: "#FAFAFA",
    muted: "#A3A3A3",
    surface: "rgba(255,255,255,0.09)",
    onInk: "#0A0A0A",
    onInkMuted: "#737373",
    line: "rgba(255,255,255,0.12)",
    panel: "rgba(10,10,10,0.6)",
    // remap the legacy `primaryColor` scheme onto neutral grays so every
    // colorScheme={primaryColor} left in the codebase renders monochrome.
    blue: {
      50: "#141414",
      100: "#1F1F1F",
      200: "#2A2A2A",
      300: "#3A3A3A",
      400: "#525252",
      500: "#A3A3A3",
      600: "#D4D4D4",
      700: "#E5E5E5",
      800: "#F5F5F5",
      900: "#FAFAFA",
    },
  },
  radii: {
    "el-sm": "4px",
    "el-md": "6px",
    "el-lg": "6px",
    "el-pill": "999px",
  },
  shadows: {
    "shadow-hard": "none",
  },
};

const subtleButtonVariant = (props: any) => ({
  bg: mode(`${props.colorScheme}.100`, `${props.colorScheme}.700`)(props),
  color: mode(`${props.colorScheme}.700`, `${props.colorScheme}.100`)(props),
  _hover: {
    bg: mode(`${props.colorScheme}.200`, `${props.colorScheme}.600`)(props),
  },
  _active: {
    bg: mode(`${props.colorScheme}.300`, `${props.colorScheme}.500`)(props),
  },
  _disabled: {
    bg: mode(`${props.colorScheme}.100`, `${props.colorScheme}.700`)(props),
    color: mode(`${props.colorScheme}.500`, `${props.colorScheme}.300`)(props),
    cursor: "not-allowed",
    opacity: 0.6,
    _hover: {
      bg: mode(
        `${props.colorScheme}.100 !important`,
        `${props.colorScheme}.700 !important`
      )(props),
    },
    _active: {
      bg: mode(
        `${props.colorScheme}.100 !important`,
        `${props.colorScheme}.700 !important`
      )(props),
    },
  },
});

const customGraySolidButtonTheme = {
  bg: "gray.600",
  color: "white",
  _hover: { bg: "gray.700" },
  _active: { bg: "gray.800" },
  _focus: { boxShadow: "none" },
  _disabled: {
    bg: "gray.500",
    color: "gray.300",
    cursor: "not-allowed",
    opacity: 0.6,
    _hover: {
      bg: "gray.500 !important",
    },
    _active: {
      bg: "gray.500 !important",
    },
  },
};

const chakraExtendTheme = extendTheme({
  ...elTokens,
  // easy-launcher: dark-only monochrome theme (docs/design/DESIGN-homebar.md).
  initialColorMode: "dark",
  useSystemColorMode: false,
  components: {
    Alert: {
      baseStyle: {
        container: {
          paddingY: 2,
        },
        title: {
          fontSize: "sm",
        },
        description: {
          fontSize: "xs-sm",
          lineHeight: 4,
        },
        icon: {
          alignSelf: "center",
        },
      },
    },
    Button: {
      baseStyle: {
        fontWeight: "normal",
      },
      defaultProps: {
        size: "sm",
      },
      variants: {
        subtle: subtleButtonVariant,
        solid: (props: any) => {
          return props.colorScheme === "gray" ? customGraySolidButtonTheme : {};
        },
      },
    },
    Divider: {
      baseStyle: {
        borderColor: "var(--chakra-colors-chakra-border-color)", // prevent overwrite
      },
    },
    FormLabel: {
      baseStyle: {
        fontSize: "sm",
      },
    },
    Input: {
      defaultProps: {
        size: "sm",
      },
    },
    Menu: {
      baseStyle: {
        groupTitle: {
          fontSize: "xs",
        },
        list: {
          minWidth: "auto",
          py: 1,
          // easy-launcher (docs/design/DESIGN-homebar.md): dark panel, faint line
          backgroundColor: "#141414",
          border: "1px solid",
          borderColor: "line",
          borderRadius: "el-md",
        },
      },
    },
    Modal: {
      baseStyle: {
        dialog: {
          // easy-launcher (docs/design/DESIGN-homebar.md): dark panel, faint line
          backgroundColor: "#141414",
          border: "1px solid",
          borderColor: "line",
          borderRadius: "el-md",
          header: {
            fontSize: "md",
            paddingLeft: 4,
            paddingRight: 8, // reserve space for close button (issue#1312)
            paddingTop: 3,
            paddingBottom: 2,
            userSelect: "none",
            cursor: "default",
          },
          footer: {
            fontSize: "sm",
            gap: 3,
            marginTop: "auto",
            paddingX: 4,
            paddingTop: 2,
            paddingBottom: 4,
            userSelect: "none",
          },
        },
        closeButton: {
          top: 2,
          right: 2,
          width: 6,
          height: 6,
          fontSize: "2xs",
        },
        body: {
          fontSize: "sm",
          paddingX: 4,
          userSelect: "none",
        },
      },
      defaultProps: {
        isCentered: true,
      },
    },
    Popover: {
      baseStyle: {
        content: {
          // easy-launcher (docs/design/DESIGN-homebar.md): dark panel, faint line
          backgroundColor: "#141414",
          border: "1px solid",
          borderColor: "line",
          borderRadius: "el-md",
        },
      },
    },
    Switch: {
      defaultProps: {
        size: "sm",
      },
    },
    Tag: {
      defaultProps: {
        size: "sm",
        whiteSpace: "nowrap",
      },
    },
    Tooltip: {
      baseStyle: {
        userSelect: "none",
        fontSize: "xs-sm",
      },
    },
  },
  fontSizes: {
    "xs-sm": "0.8rem",
  },
});

export default chakraExtendTheme;

import { extendTheme } from "@chakra-ui/react";

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
  // easy-launcher (docs/design/DESIGN-homebar.md): monochrome controls —
  // dark theme only, no per-color-mode variants.
  bg: "rgba(255,255,255,0.09)",
  color: "#FAFAFA",
  _hover: {
    bg: "rgba(255,255,255,0.14)",
  },
  _active: {
    bg: "rgba(255,255,255,0.18)",
  },
  _disabled: {
    bg: "rgba(255,255,255,0.09)",
    color: "#525252",
    cursor: "not-allowed",
    opacity: 0.6,
    _hover: {
      bg: "rgba(255,255,255,0.09) !important",
    },
    _active: {
      bg: "rgba(255,255,255,0.09) !important",
    },
  },
});

// easy-launcher (docs/design/DESIGN-homebar.md): monochrome ghost button —
// bright text on transparent, faint white wash on hover.
const ghostButtonVariant = {
  color: "#FAFAFA",
  _hover: { bg: "rgba(255,255,255,0.09)", color: "#FAFAFA" },
  _active: { bg: "rgba(255,255,255,0.14)", color: "#FAFAFA" },
  _disabled: {
    color: "#525252",
    cursor: "not-allowed",
  },
};

const customGraySolidButtonTheme = {
  bg: "#FAFAFA",
  color: "#0A0A0A",
  _hover: { bg: "#FFFFFF" },
  _active: { bg: "#FFFFFF" },
  _focus: { boxShadow: "none" },
  _disabled: {
    bg: "#525252",
    color: "#A3A3A3",
    cursor: "not-allowed",
    opacity: 0.6,
    _hover: {
      bg: "#525252 !important",
    },
    _active: {
      bg: "#525252 !important",
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
        ghost: ghostButtonVariant,
        solid: (props: any) => {
          return props.colorScheme === "gray" ? customGraySolidButtonTheme : {};
        },
      },
    },
    Divider: {
      baseStyle: {
        borderColor: "line",
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
    // easy-launcher: bump the base scale ~1px — the stock Chakra sizes run
    // small on high-DPI desktops.
    "xs-sm": "0.8rem",
    xs: "0.8rem",
    sm: "0.925rem",
    md: "1.05rem",
    lg: "1.2rem",
    xl: "1.3rem",
  },
});

export default chakraExtendTheme;

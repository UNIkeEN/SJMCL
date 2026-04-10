import { extendTheme } from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";

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
        },
      },
    },
    Modal: {
      baseStyle: {
        dialog: {
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
          boxShadow: "md",
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

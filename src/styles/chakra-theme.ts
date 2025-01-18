import { CloseButton, extendTheme } from "@chakra-ui/react";

const subtleButtonVariant = (props: any) => ({
  bg: `${props.colorScheme}.100`,
  color: `${props.colorScheme}.700`,
  _hover: {
    bg: `${props.colorScheme}.200`,
  },
  _active: {
    bg: `${props.colorScheme}.300`,
  },
  _focus: {
    boxShadow: "none",
  },
  _disabled: {
    bg: `${props.colorScheme}.100`,
    color: `${props.colorScheme}.500`,
    cursor: "not-allowed",
    opacity: 0.6,
    _hover: {
      bg: `${props.colorScheme}.100 !important`,
    },
    _active: {
      bg: `${props.colorScheme}.100 !important`,
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
  components: {
    Alert: {
      baseStyle: {
        container: {
          paddingY: 2,
        },
        title: {
          fontSize: "sm",
          marginBottom: -0.5,
        },
        description: {
          fontSize: "xs",
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
        borderColor: "gray.300",
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
            paddingX: 4,
            paddingTop: 3,
            paddingBottom: 2,
          },
          footer: {
            fontSize: "sm",
            paddingX: 4,
            paddingTop: 2,
            paddingBottom: 4,
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
        },
      },
      defaultProps: {
        size: {
          base: "md",
          lg: "lg",
          xl: "xl",
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
      },
    },
    Tooltip: {
      baseStyle: {
        fontSize: "xs-sm",
      },
    },
  },
  fontSizes: {
    "xs-sm": "0.8rem",
  },
});

export default chakraExtendTheme;

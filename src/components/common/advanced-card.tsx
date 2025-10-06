import { Box, BoxProps, Card, useColorMode } from "@chakra-ui/react";
import React, { forwardRef } from "react";
import { useLauncherConfig } from "@/contexts/config";
import { useThemedCSSStyle } from "@/hooks/themed-css";
import {
  deriveSurfaceStyle,
  resolveSurfaceTokens,
  surfaceStyleToVariant,
} from "@/utils/theme/surface-style";

interface AdvancedCardProps extends Omit<BoxProps, "children"> {
  variant?: string;
  level?: "back" | "front";
  children?: React.ReactNode;
}

const AdvancedCard = forwardRef<HTMLDivElement, AdvancedCardProps>(
  ({ variant = "", level = "back", children, ...restProps }, ref) => {
    const { config } = useLauncherConfig();
    const { colorMode } = useColorMode();
    const themedStyles = useThemedCSSStyle();
    const surfaceStyle = deriveSurfaceStyle(
      config.appearance.theme.surfaceStyle,
      config.appearance.theme.useLiquidGlassDesign
    );
    const tokens = resolveSurfaceTokens(surfaceStyle, colorMode);
    const defaultVariant = surfaceStyleToVariant(surfaceStyle);
    const resolvedVariant = variant || defaultVariant;

    const {
      className: classNameProp = "",
      style: styleProp,
      ...passthroughProps
    } = restProps;

    const baseClassName = [themedStyles.card[`card-${level}`], classNameProp]
      .filter(Boolean)
      .join(" ");

    if (resolvedVariant === "acrylic") {
      const mergedStyle: React.CSSProperties = {
        ...((styleProp as React.CSSProperties) || {}),
        backdropFilter: tokens["--sjmcl-acrylic-backdrop"],
        WebkitBackdropFilter: tokens["--sjmcl-acrylic-backdrop"],
      };

      return (
        <Card
          ref={ref}
          borderRadius="xl"
          borderWidth="1px"
          borderColor={tokens["--sjmcl-acrylic-border"]}
          boxShadow={tokens["--sjmcl-acrylic-shadow"]}
          bg={tokens["--sjmcl-acrylic-bg"]}
          {...passthroughProps}
          className={baseClassName}
          style={mergedStyle}
        >
          {children}
        </Card>
      );
    }

    if (
      ["elevated", "outline", "filled", "unstyled"].includes(resolvedVariant)
    ) {
      return (
        <Card
          ref={ref}
          variant={resolvedVariant}
          {...passthroughProps}
          className={baseClassName}
          style={styleProp}
        >
          {children}
        </Card>
      );
    }

    if (resolvedVariant === "liquid-glass") {
      const wrapperClassName = [
        themedStyles.liquidGlass["wrapper"],
        classNameProp,
      ]
        .filter(Boolean)
        .join(" ");

      return (
        <Box
          ref={ref}
          {...passthroughProps}
          className={wrapperClassName}
          style={styleProp as React.CSSProperties}
        >
          <div className={themedStyles.liquidGlass["effect"]} />
          <div className={themedStyles.liquidGlass["shine"]} />
          <Box position="relative" zIndex={3} height="100%" width="100%">
            {children}
          </Box>
        </Box>
      );
    }

    return (
      <Card
        ref={ref}
        {...passthroughProps}
        className={baseClassName}
        style={styleProp}
      >
        {children}
      </Card>
    );
  }
);

AdvancedCard.displayName = "AdvancedCard";

export default AdvancedCard;

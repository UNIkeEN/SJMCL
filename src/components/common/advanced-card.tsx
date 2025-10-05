import { Box, BoxProps, Card, useColorModeValue } from "@chakra-ui/react";
import React, { forwardRef } from "react";
import { useLauncherConfig } from "@/contexts/config";
import { useThemedCSSStyle } from "@/hooks/themed-css";

interface AdvancedCardProps extends Omit<BoxProps, "children"> {
  variant?: string;
  level?: "back" | "front";
  children?: React.ReactNode;
}

const AdvancedCard = forwardRef<HTMLDivElement, AdvancedCardProps>(
  ({ variant = "", level = "back", children, ...props }, ref) => {
    const { config } = useLauncherConfig();
    const themedStyles = useThemedCSSStyle();
    const acrylicBackground = useColorModeValue(
      "rgba(255, 255, 255, 0.72)",
      "rgba(15, 18, 26, 0.66)"
    );
    const acrylicBorder = useColorModeValue(
      "rgba(148, 163, 184, 0.28)",
      "rgba(255, 255, 255, 0.08)"
    );
    const acrylicShadow = useColorModeValue(
      "0 18px 32px rgba(148, 163, 184, 0.25)",
      "0 18px 32px rgba(2, 12, 27, 0.4)"
    );

    const _variant =
      variant ||
      (config.appearance.theme.useLiquidGlassDesign
        ? "liquid-glass"
        : "elevated");

    if (_variant === "acrylic") {
      return (
        <Card
          ref={ref}
          bg={acrylicBackground}
          borderRadius="xl"
          borderWidth="1px"
          borderColor={acrylicBorder}
          boxShadow={acrylicShadow}
          backdropFilter="blur(18px)"
          {...props}
          className={`${props.className || ""}`.trim()}
        >
          {children}
        </Card>
      );
    }

    if (["elevated", "outline", "filled", "unstyled"].includes(_variant)) {
      return (
        <Card
          ref={ref}
          variant={_variant}
          {...props}
          className={`${themedStyles.card[`card-${level}`]} ${props.className || ""}`}
        >
          {children}
        </Card>
      );
    }

    if (_variant == "liquid-glass") {
      return (
        <Box
          ref={ref}
          {...props}
          className={`${themedStyles.liquidGlass["wrapper"]} ${props.className || ""}`}
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
        {...props}
        className={`${themedStyles.card[`card-${level}`]} ${props.className || ""}`}
      >
        {children}
      </Card>
    );
  }
);

AdvancedCard.displayName = "AdvancedCard";

export default AdvancedCard;

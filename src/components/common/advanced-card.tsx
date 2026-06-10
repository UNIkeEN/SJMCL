import { Box, BoxProps, Card } from "@chakra-ui/react";
import React, { forwardRef } from "react";
import { useLauncherConfig } from "@/contexts/config";
import cardStyles from "@/styles/card.module.css";
import liquidGlassStyles from "@/styles/liquid-glass.module.css";

interface AdvancedCardProps extends Omit<BoxProps, "children"> {
  variant?: string;
  level?: "back" | "front";
  children?: React.ReactNode;
}

const AdvancedCard = forwardRef<HTMLDivElement, AdvancedCardProps>(
  ({ variant = "", level = "back", children, ...props }, ref) => {
    const { config } = useLauncherConfig();
    const _variant =
      variant ||
      (config.appearance.theme.liquidGlassDesign.enabled
        ? "liquid-glass"
        : "elevated");

    const { opacity } = config.appearance.theme.liquidGlassDesign;
    const lightAlpha = Math.min(1, Math.max(0, 0.5 + (opacity - 33) * 0.002));
    const darkAlpha = Math.min(1, Math.max(0, 0.78 + (opacity - 33) * 0.001));

    if (["elevated", "outline", "filled", "unstyled"].includes(_variant)) {
      return (
        <Card
          ref={ref}
          variant={_variant}
          {...props}
          className={`${cardStyles[`card-${level}`]} ${props.className || ""}`}
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
          className={`${liquidGlassStyles["wrapper"]} ${props.className || ""}`}
          style={
            {
              ...props.style,
              "--lg-opacity-light": lightAlpha,
              "--lg-opacity-dark": darkAlpha,
            } as React.CSSProperties
          }
        >
          <div className={liquidGlassStyles["effect"]} />
          <div className={liquidGlassStyles["shine"]} />
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
        className={`${cardStyles[`card-${level}`]} ${props.className || ""}`}
      >
        {children}
      </Card>
    );
  }
);

AdvancedCard.displayName = "AdvancedCard";

export default AdvancedCard;

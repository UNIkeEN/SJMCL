import { Box, BoxProps, Card } from "@chakra-ui/react";
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

    const _variant =
      variant ||
      (config.appearance.theme.useLiquidGlassDesign
        ? "liquid-glass"
        : "elevated");

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

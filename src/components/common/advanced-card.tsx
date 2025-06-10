import { Box, BoxProps, Card } from "@chakra-ui/react";
import { useLauncherConfig } from "@/contexts/config";
import { useThemedCSSStyle } from "@/hooks/themed-css";

interface AdvancedCardProps extends Omit<BoxProps, "children"> {
  variant?: string;
  level?: "back" | "front";
  children?: React.ReactNode;
}

const AdvancedCard: React.FC<AdvancedCardProps> = ({
  variant = "",
  level = "back",
  children,
  ...props
}) => {
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
        className={themedStyles.card[`card-${level}`]}
        variant={_variant}
        {...props}
      >
        {children}
      </Card>
    );
  }

  if (_variant == "liquid-glass") {
    return (
      <Box className={themedStyles.liquidGlass["wrapper"]} {...props}>
        <div className={themedStyles.liquidGlass["effect"]} />
        <div className={themedStyles.liquidGlass["shine"]} />
        <Box position="relative" zIndex={3} height="100%" width="100%">
          {children}
        </Box>
      </Box>
    );
  }

  return (
    <Card className={themedStyles.card[`card-${level}`]} {...props}>
      {children}
    </Card>
  );
};

export default AdvancedCard;

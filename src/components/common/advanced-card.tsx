import { BoxProps, Card } from "@chakra-ui/react";
import React, { forwardRef } from "react";
import cardStyles from "@/styles/card.module.css";

interface AdvancedCardProps extends Omit<BoxProps, "children"> {
  variant?: string;
  level?: "back" | "front";
  children?: React.ReactNode;
}

// easy-launcher (docs/design/DESIGN.md): liquid glass removed — plain cards only.
const AdvancedCard = forwardRef<HTMLDivElement, AdvancedCardProps>(
  ({ variant = "", level = "back", children, ...props }, ref) => {
    const _variant = variant || "elevated";

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

import { ButtonProps, HStack } from "@chakra-ui/react";
import React from "react";

interface CompactButtonGroupProps {
  children: React.ReactNode;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  colorScheme?: ButtonProps["colorScheme"];
  borderRadius?: string;
}

/**
 * Ant-design-like compact button group component.
 */
export const CompactButtonGroup: React.FC<CompactButtonGroupProps> = ({
  children,
  size = "sm",
  variant = "solid",
  colorScheme = "blue",
  borderRadius = "md",
}) => {
  const validChildren = React.Children.toArray(children).filter((child) =>
    React.isValidElement<ButtonProps>(child)
  ) as React.ReactElement<ButtonProps>[];

  const total = validChildren.length;

  return (
    <HStack spacing={0}>
      {validChildren.map((child, index) => {
        const sharedProps: Partial<ButtonProps> = {
          size,
          variant,
          colorScheme,
          borderRadius: "0",
        };

        // compact effect button style
        if (index === 0) {
          sharedProps.borderTopLeftRadius = borderRadius;
          sharedProps.borderBottomLeftRadius = borderRadius;
        }
        if (index === total - 1) {
          sharedProps.borderTopRightRadius = borderRadius;
          sharedProps.borderBottomRightRadius = borderRadius;
        }

        return React.cloneElement(child, {
          ...sharedProps,
          ...child.props,
        });
      })}
    </HStack>
  );
};

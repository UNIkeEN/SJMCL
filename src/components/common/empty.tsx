import { Box, BoxProps, HStack, Text, VStack } from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineInbox } from "react-icons/hi2";

interface EmptyProps extends BoxProps {
  colorScheme?: string;
  size?: "sm" | "md" | "lg" | number;
  description?: string;
  children?: React.ReactNode;
  withIcon?: boolean;
}

const iconSizeMap: Record<"sm" | "md" | "lg", string> = {
  sm: "1.5em",
  md: "2em",
  lg: "3.5em",
};

const Empty: React.FC<EmptyProps> = ({
  colorScheme = "gray",
  size = "md",
  description,
  children,
  withIcon = true,
  ...boxProps
}) => {
  const { t } = useTranslation();
  const iconSize =
    typeof size === "number" ? `${size}px` : iconSizeMap[size] || "2.5em";
  const textSize = typeof size === "number" ? "md" : size;
  const isLargeSize = typeof size === "number" ? size > 40 : size === "lg";

  return (
    <Box textAlign="center" color={`${colorScheme}.400`} p={4} {...boxProps}>
      {isLargeSize ? (
        <VStack spacing={4} justifyContent="center" alignItems="center">
          {withIcon && <HiOutlineInbox size={iconSize} />}
          <Text fontSize={textSize} color={`${colorScheme}.500`}>
            {description ? description : t("Empty.noData")}
          </Text>
          {children}
        </VStack>
      ) : (
        <VStack spacing={4}>
          <HStack spacing={3} justifyContent="center" alignItems="center">
            {withIcon && <HiOutlineInbox size={iconSize} />}
            <Text fontSize={textSize} color={`${colorScheme}.500`}>
              {description ? description : t("Empty.noData")}
            </Text>
          </HStack>
          {children}
        </VStack>
      )}
    </Box>
  );
};

export default Empty;

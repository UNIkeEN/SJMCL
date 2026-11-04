import { Icon, useColorModeValue } from "@chakra-ui/react";
import { LuChevronRight } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";

export const CardChevron = ({
  isSelected = false,
  isDisabled = false,
}: {
  isSelected?: boolean;
  isDisabled?: boolean;
}) => {
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const hoverColor = useColorModeValue(
    `${primaryColor}.300`,
    `${primaryColor}.700`
  );

  return (
    <Icon
      as={LuChevronRight}
      aria-hidden
      boxSize={6}
      p={1.25}
      color={isSelected && !isDisabled ? `${primaryColor}.500` : undefined}
      _groupHover={
        isDisabled
          ? undefined
          : { color: isSelected ? `${primaryColor}.500` : hoverColor }
      }
    />
  );
};

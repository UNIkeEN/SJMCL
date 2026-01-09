import {
  Card,
  CardProps,
  Flex,
  HStack,
  Icon,
  IconButton,
  Image,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuChevronRight, LuX } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";
import { useThemedCSSStyle } from "@/hooks/themed-css";

export interface SelectableCardProps extends CardProps {
  title: string;
  iconSrc?: string;
  description?: string;
  displayMode: "entry" | "selector";
  isLoading?: boolean;
  isDisabled?: boolean;
  isSelected: boolean;
  isChevronShown?: boolean;
  onSelect: () => void;
  onCancel?: () => void;
}

const SelectableCard: React.FC<SelectableCardProps> = ({
  title,
  iconSrc,
  description,
  displayMode,
  isLoading = false,
  isDisabled = false,
  isSelected,
  isChevronShown = true,
  onSelect,
  onCancel,
  ...boxProps
}) => {
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const themedStyles = useThemedCSSStyle();

  const borderWidth = "1px";
  const basePadding = boxProps.padding || "12px";
  const selectedPadding = `calc(${basePadding} - ${borderWidth})`;

  return (
    <Card
      className={themedStyles.card["card-front"]}
      pr={1.5}
      variant={isSelected ? "outline" : "elevated"}
      borderColor={isSelected ? `${primaryColor}.500` : "transparent"}
      borderWidth={isSelected ? borderWidth : 0}
      p={isSelected ? selectedPadding : basePadding}
      {...boxProps}
    >
      <Flex justify="space-between" alignItems="center">
        <HStack spacing={2}>
          {!!iconSrc && (
            <Image
              src={iconSrc}
              alt={title}
              boxSize="28px"
              style={{ borderRadius: "4px" }}
            />
          )}
          <VStack spacing={0} alignItems="start">
            <Text
              fontSize="xs-sm"
              fontWeight={isSelected ? "bold" : "normal"}
              color={isSelected ? `${primaryColor}.600` : "inherit"}
            >
              {title}
            </Text>
            {!!description && (
              <Text fontSize="xs" className="secondary-text">
                {description}
              </Text>
            )}
          </VStack>
        </HStack>
        <HStack spacing={0}>
          {displayMode === "selector" && isSelected && !!onCancel && (
            <IconButton
              aria-label={title}
              icon={<Icon as={LuX} boxSize={3.5} />}
              variant="ghost"
              size="xs"
              disabled={isLoading || isDisabled}
              onClick={() => onCancel()}
            />
          )}
          {isChevronShown && (
            <IconButton
              aria-label={title}
              icon={<Icon as={LuChevronRight} boxSize={3.5} />}
              variant="ghost"
              size="xs"
              disabled={isLoading || isDisabled}
              onClick={() => onSelect()}
            />
          )}
        </HStack>
      </Flex>
    </Card>
  );
};

export default SelectableCard;

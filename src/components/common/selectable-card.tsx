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
  useColorModeValue,
} from "@chakra-ui/react";
import { LuChevronRight, LuX } from "react-icons/lu";
import { CardChevron } from "@/components/common/card-chevron";
import { useLauncherConfig } from "@/contexts/config";
import cardStyles from "@/styles/card.module.css";

export interface SelectableCardProps extends Omit<CardProps, "onClick"> {
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
  const isCancellable = displayMode === "selector" && isSelected && !!onCancel;
  const isFullClickZone = isChevronShown && !isCancellable;
  const isInteractive = isFullClickZone && !isLoading && !isDisabled;
  const hasBorder = isSelected || isFullClickZone;
  const borderWidth = "1px";
  const basePadding = boxProps.padding || "12px";
  const borderedPadding = `calc(${basePadding} - ${borderWidth})`;
  const hoverBorderColor = useColorModeValue(
    `${primaryColor}.300`,
    `${primaryColor}.700`
  );

  return (
    <Card
      className={cardStyles["card-front"]}
      data-group=""
      pr={1.5}
      variant={isSelected ? "outline" : "elevated"}
      borderColor={isSelected ? `${primaryColor}.500` : "transparent"}
      borderWidth={hasBorder ? borderWidth : 0}
      p={hasBorder ? borderedPadding : basePadding}
      textAlign="start"
      transition="border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out"
      {...(isFullClickZone && {
        as: "button",
        type: "button",
        disabled: isLoading || isDisabled,
        onClick: onSelect,
      })}
      {...(isInteractive && {
        cursor: "pointer",
        _hover: {
          borderColor: isSelected ? `${primaryColor}.500` : hoverBorderColor,
          boxShadow: "md",
        },
        _active: { boxShadow: "sm" },
      })}
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
              onClick={(event) => {
                event.stopPropagation();
                onCancel();
              }}
            />
          )}
          {isFullClickZone ? (
            <CardChevron isSelected={isSelected} isDisabled={!isInteractive} />
          ) : isChevronShown ? (
            <IconButton
              aria-label={title}
              icon={<Icon as={LuChevronRight} boxSize={3.5} />}
              variant="ghost"
              size="xs"
              disabled={isLoading || isDisabled}
              onClick={(event) => {
                event.stopPropagation();
                onSelect();
              }}
            />
          ) : null}
        </HStack>
      </Flex>
    </Card>
  );
};

export default SelectableCard;

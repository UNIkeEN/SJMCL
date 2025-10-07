import {
  Box,
  BoxProps,
  Collapse,
  Flex,
  HStack,
  Icon,
  IconButton,
  Text,
  TextProps,
  VStack,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import type { KeyboardEvent } from "react";
import { LuArrowLeft, LuChevronRight } from "react-icons/lu";

export interface SectionProps extends Omit<BoxProps, "children"> {
  title?: string;
  titleExtra?: React.ReactNode;
  headExtra?: React.ReactNode;
  description?: string;
  isAccordion?: boolean;
  initialIsOpen?: boolean;
  onAccordionToggle?: (isOpen: boolean) => void;
  withBackButton?: boolean;
  backRoutePath?: string;
  children?: React.ReactNode;
  maxTitleLines?: number;
}

export const Section: React.FC<SectionProps> = ({
  title,
  titleExtra,
  headExtra,
  description,
  isAccordion = false,
  initialIsOpen = true,
  onAccordionToggle,
  withBackButton = false,
  maxTitleLines = undefined,
  backRoutePath = "",
  children,
  ...props
}) => {
  const { isOpen, onToggle: internalOnToggle } = useDisclosure({
    defaultIsOpen: initialIsOpen,
  });
  const router = useRouter();
  const hoverBg = useColorModeValue("blackAlpha.50", "whiteAlpha.100");
  const lineClampProps: TextProps = {
    noOfLines: maxTitleLines,
    sx: {
      wordBreak: "break-all",
    },
  };

  const handleToggle = () => {
    if (!isAccordion) return;
    onAccordionToggle?.(!isOpen);
    internalOnToggle();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isAccordion) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggle();
    }
  };

  const interactiveHeaderProps = isAccordion
    ? {
        role: "button" as const,
        tabIndex: 0,
        cursor: "pointer",
        onClick: handleToggle,
        onKeyDown: handleKeyDown,
        borderRadius: "md",
        px: 2,
        py: 1,
        transition: "background 0.2s ease",
        _hover: {
          bg: hoverBg,
        },
        _focusVisible: {
          boxShadow: "outline",
        },
      }
    : {};
  return (
    <Box {...props}>
      {(isAccordion || title || description || titleExtra || headExtra) && (
        <Flex
          alignItems="center"
          flexShrink={0}
          mb={isOpen ? 2.5 : 0}
          {...interactiveHeaderProps}
        >
          <HStack spacing={1}>
            {withBackButton && (
              <IconButton
                aria-label="back"
                icon={<Icon as={LuArrowLeft} boxSize={3.5} />}
                size="xs"
                h={21}
                variant="ghost"
                colorScheme="gray"
                onClick={(event) => {
                  event.stopPropagation();
                  if (backRoutePath) router.push(backRoutePath);
                  else router.back();
                }}
              />
            )}
            {isAccordion && (
              <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                w={6}
                h={6}
              >
                <Icon
                  as={LuChevronRight}
                  boxSize={3.5}
                  sx={{
                    transition: "transform 0.2s ease-in-out",
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  }}
                />
              </Box>
            )}
            <VStack spacing={0} align="start">
              <HStack spacing={2}>
                {title && (
                  <Text
                    fontWeight="bold"
                    fontSize="sm"
                    {...(maxTitleLines ? lineClampProps : {})}
                  >
                    {title}
                  </Text>
                )}
                {titleExtra}
              </HStack>
              {description && (
                <Text fontSize="xs" className="secondary-text">
                  {description}
                </Text>
              )}
            </VStack>
          </HStack>
          <Box ml="auto" display="flex">
            {headExtra}
          </Box>
        </Flex>
      )}
      {isAccordion ? (
        <Collapse in={isOpen} animateOpacity>
          {children}
        </Collapse>
      ) : (
        children
      )}
    </Box>
  );
};

import {
  Box,
  BoxProps,
  Card,
  Divider,
  Flex,
  HStack,
  Skeleton,
  Text,
  VStack,
  Wrap,
  useColorModeValue,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { Section, SectionProps } from "@/components/common/section";
import { useThemedCSSStyle } from "@/hooks/themed-css";

export interface OptionItemProps extends Omit<BoxProps, "title"> {
  prefixElement?: React.ReactNode;
  title: React.ReactNode;
  titleExtra?: React.ReactNode;
  titleLineWrap?: boolean;
  description?: React.ReactNode;
  isLoading?: boolean;
  isFullClickZone?: boolean;
  children?: React.ReactNode;
  childrenOnHover?: boolean;
}

export interface OptionItemGroupProps extends SectionProps {
  items: (OptionItemProps | React.ReactNode)[];
  withDivider?: boolean;
}

export const OptionItem: React.FC<OptionItemProps> = ({
  prefixElement,
  title,
  titleExtra,
  titleLineWrap = true,
  description,
  isLoading = false,
  isFullClickZone = false,
  children,
  childrenOnHover = false,
  ...boxProps
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const palettes = useColorModeValue([100, 200, 300], [900, 800, 700]);

  const _title =
    typeof title === "string" ? (
      <Skeleton isLoaded={!isLoading}>
        <Text fontSize="xs-sm">{title}</Text>
      </Skeleton>
    ) : (
      title
    );

  const _titleExtra =
    titleExtra &&
    (isLoading ? (
      <Skeleton isLoaded={!isLoading}>
        <Text fontSize="xs-sm">
          PLACEHOLDER {/*width holder for skeleton*/}
        </Text>
      </Skeleton>
    ) : (
      titleExtra
    ));

  return (
    <Flex
      justify="space-between"
      alignItems="center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      borderRadius="md"
      _hover={{
        bg: isFullClickZone ? `gray.${palettes[0]}` : "inherit",
        transition: "background-color 0.2s ease-in-out",
      }}
      _active={{
        bg: isFullClickZone ? `gray.${palettes[1]}` : "inherit",
        transition: "background-color 0.1s ease-in-out",
      }}
      cursor={isFullClickZone ? "pointer" : "default"}
      {...boxProps}
    >
      <HStack spacing={2.5} overflowY="hidden">
        {prefixElement && (
          <Skeleton isLoaded={!isLoading}>{prefixElement}</Skeleton>
        )}
        <VStack
          spacing={0}
          mr={2}
          alignItems="start"
          overflow="hidden"
          flex="1"
        >
          {titleLineWrap ? (
            <Wrap spacingX={2} spacingY={0.5}>
              {_title}
              {titleExtra && _titleExtra}
            </Wrap>
          ) : (
            <HStack spacing={2} flexWrap="nowrap">
              {_title}
              {titleExtra && _titleExtra}
            </HStack>
          )}

          {description &&
            (typeof description === "string" ? (
              <Skeleton isLoaded={!isLoading}>
                <Text fontSize="xs" className="secondary-text">
                  {description}
                </Text>
              </Skeleton>
            ) : (
              description
            ))}
        </VStack>
      </HStack>
      {(childrenOnHover ? isHovered : true) &&
        (typeof children === "string" ? (
          <Skeleton isLoaded={!isLoading}>
            <Text fontSize="xs-sm" className="secondary-text">
              {children}
            </Text>
          </Skeleton>
        ) : (
          children
        ))}
    </Flex>
  );
};

export const OptionItemGroup: React.FC<OptionItemGroupProps> = ({
  items,
  withDivider = true,
  ...props
}) => {
  const themedStyles = useThemedCSSStyle();

  function isOptionItemProps(item: any): item is OptionItemProps {
    return (
      (item as OptionItemProps)?.title != null &&
      (item as OptionItemProps)?.children != null
    );
  }

  return (
    <Section {...props}>
      {items.length > 0 && (
        <Card className={themedStyles.card["card-front"]}>
          {items.map((item, index) => (
            <React.Fragment key={index}>
              {isOptionItemProps(item) ? <OptionItem {...item} /> : item}
              {index !== items.length - 1 &&
                (withDivider ? <Divider my={2} /> : <Box h={2} />)}
            </React.Fragment>
          ))}
        </Card>
      )}
    </Section>
  );
};

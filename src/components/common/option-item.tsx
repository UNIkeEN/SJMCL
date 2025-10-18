import {
  Box,
  BoxProps,
  Button,
  Card,
  Divider,
  Flex,
  HStack,
  Skeleton,
  Text,
  TextProps,
  VStack,
  Wrap,
  useColorModeValue,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Section, SectionProps } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
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
  isChildrenIndependent?: boolean;
  maxTitleLines?: number;
  maxDescriptionLines?: number;
}

export interface OptionItemGroupProps extends SectionProps {
  items: (OptionItemProps | React.ReactNode)[];
  withInCard?: boolean;
  withDivider?: boolean;
  maxFirstVisibleItems?: number;
  enableShowAll?: boolean;
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
  isChildrenIndependent = false,
  maxTitleLines = undefined,
  maxDescriptionLines = undefined,
  ...boxProps
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const palettes = useColorModeValue([100, 200, 300], [900, 800, 700]);

  const titleLineClampProps: TextProps = {
    noOfLines: maxTitleLines,
    sx: {
      wordBreak: "break-all",
    },
  };

  const descriptionLineClampProps: TextProps = {
    noOfLines: maxDescriptionLines,
    sx: {
      wordBreak: "break-all",
    },
  };

  const _title =
    typeof title === "string" ? (
      <Skeleton isLoaded={!isLoading}>
        <Text fontSize="xs-sm" {...(maxTitleLines ? titleLineClampProps : {})}>
          {title}
        </Text>
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

  const wrappedChildren =
    (childrenOnHover ? isHovered : true) &&
    (typeof children === "string" ? (
      <Skeleton isLoaded={!isLoading}>
        <Text fontSize="xs-sm" className="secondary-text">
          {children}
        </Text>
      </Skeleton>
    ) : (
      children
    ));

  return (
    <Flex justify="space-between" alignItems="center">
      <Flex
        flex={1}
        justify="space-between"
        alignItems="center"
        overflow="hidden"
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
        p={0.5}
        {...boxProps}
      >
        <HStack spacing={2.5} overflow="hidden">
          {prefixElement && (
            <Skeleton isLoaded={!isLoading} flex="0 0 auto">
              {prefixElement}
            </Skeleton>
          )}
          <VStack
            spacing={0}
            mr={2}
            alignItems="stretch"
            overflow="hidden"
            flex={"1 1 auto"}
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
                  <Text
                    fontSize="xs"
                    className="secondary-text"
                    {...(maxDescriptionLines ? descriptionLineClampProps : {})}
                  >
                    {description}
                  </Text>
                </Skeleton>
              ) : (
                description
              ))}
          </VStack>
        </HStack>
        {!isChildrenIndependent && wrappedChildren}
      </Flex>
      {isChildrenIndependent && wrappedChildren}
    </Flex>
  );
};

export const OptionItemGroup: React.FC<OptionItemGroupProps> = ({
  items,
  withInCard = true,
  withDivider = true,
  maxFirstVisibleItems,
  enableShowAll = true,
  ...props
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const themedStyles = useThemedCSSStyle();
  const [showAll, setShowAll] = useState(false);

  function isOptionItemProps(item: any): item is OptionItemProps {
    return (
      (item as OptionItemProps)?.title != null &&
      (item as OptionItemProps)?.children != null
    );
  }

  const hasShowAllBtn = !(
    !maxFirstVisibleItems ||
    showAll ||
    items.length <= maxFirstVisibleItems
  );

  const visibleItems = hasShowAllBtn
    ? [...items.slice(0, maxFirstVisibleItems)]
    : items;

  const renderItems = () => (
    <>
      {[...visibleItems].map((item, index) => (
        <React.Fragment key={index}>
          {isOptionItemProps(item) ? <OptionItem {...item} /> : item}
          {index !== visibleItems.length - 1 &&
            (withDivider ? <Divider my={1.5} /> : <Box h={1.5} />)}
        </React.Fragment>
      ))}
      {hasShowAllBtn && (
        <Box>
          <Button
            key="show-all"
            size="xs"
            colorScheme={primaryColor}
            variant="ghost"
            onClick={() => setShowAll(!showAll)}
            mt={1.5}
            ml={-1.5}
            disabled={!enableShowAll}
          >
            {t("OptionItemGroup.button.showAll", {
              left: items.length - maxFirstVisibleItems,
            })}
          </Button>
        </Box>
      )}
    </>
  );

  return (
    <Section {...props}>
      {items.length > 0 &&
        (withInCard ? (
          <Card className={themedStyles.card["card-front"]} py={2.5}>
            {renderItems()}
          </Card>
        ) : (
          renderItems()
        ))}
    </Section>
  );
};

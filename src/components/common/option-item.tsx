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
} from "@chakra-ui/react";
import React, { useState } from "react";
import { Section, SectionProps } from "@/components/common/section";
import { useThemedCSSStyle } from "@/hooks/themed-css";

export interface OptionItemProps extends Omit<BoxProps, "title"> {
  prefixElement?: React.ReactNode;
  title: React.ReactNode;
  titleExtra?: React.ReactNode;
  description?: React.ReactNode;
  isLoading?: boolean;
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
  description,
  isLoading = false,
  children,
  childrenOnHover = false,
  ...boxProps
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Flex
      justify="space-between"
      alignItems="center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
          <HStack spacing={2} flexWrap="wrap">
            {typeof title === "string" ? (
              <Skeleton isLoaded={!isLoading}>
                <Text fontSize="xs-sm" className="no-select">
                  {title}
                </Text>
              </Skeleton>
            ) : (
              title
            )}
            {titleExtra &&
              (isLoading ? (
                <Skeleton isLoaded={!isLoading}>
                  <Text fontSize="xs-sm">
                    PLACEHOLDER {/*width holder for skeleton*/}
                  </Text>
                </Skeleton>
              ) : (
                titleExtra
              ))}
          </HStack>
          {description &&
            (typeof description === "string" ? (
              <Skeleton isLoaded={!isLoading}>
                <Text fontSize="xs" className="secondary-text no-select">
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
              {isOptionItemProps(item) ? (
                <OptionItem
                  title={item.title}
                  description={item.description}
                  titleExtra={item.titleExtra}
                  prefixElement={item.prefixElement}
                >
                  {item.children}
                </OptionItem>
              ) : (
                item
              )}
              {index !== items.length - 1 &&
                (withDivider ? <Divider my={2} /> : <Box h={2} />)}
            </React.Fragment>
          ))}
        </Card>
      )}
    </Section>
  );
};

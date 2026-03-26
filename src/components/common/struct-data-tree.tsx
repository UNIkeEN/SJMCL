import { Text, TextProps, VStack } from "@chakra-ui/react";
import React from "react";

interface StructDataTreeProps {
  data: any;
  depth?: number;
  indentSize?: number;
  titleProps?: TextProps;
  valueProps?: TextProps;
}

const StructDataTree: React.FC<StructDataTreeProps> = ({
  data,
  depth = 0,
  indentSize = 2,
  titleProps = { fontWeight: "bold", fontSize: "sm" },
  valueProps = { fontWeight: "normal", fontSize: "sm" },
}) => {
  if (typeof data !== "object" || data === null) {
    return (
      <Text ml={depth * indentSize} {...valueProps}>
        {String(data)}
      </Text>
    );
  }

  return (
    <VStack align="start" spacing={1} ml={depth * indentSize}>
      {Object.entries(data).map(([key, value]) => (
        <VStack align="stretch" spacing={0} key={key}>
          <Text ml={depth * indentSize} {...titleProps} display="inline">
            {key}:{" "}
            {typeof value !== "object" || value === null ? (
              <Text as="span" {...valueProps}>
                {String(value)}
              </Text>
            ) : null}
          </Text>
          {typeof value === "object" && value !== null ? (
            <StructDataTree
              data={value}
              depth={depth + 1}
              indentSize={indentSize}
              titleProps={titleProps}
              valueProps={valueProps}
            />
          ) : null}
        </VStack>
      ))}
    </VStack>
  );
};

export default StructDataTree;

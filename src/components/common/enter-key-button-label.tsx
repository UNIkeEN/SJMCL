import { Badge, HStack, useColorModeValue } from "@chakra-ui/react";

interface EnterKeyButtonLabelProps {
  children: React.ReactNode;
}

const EnterKeyButtonLabel: React.FC<EnterKeyButtonLabelProps> = ({
  children,
}) => (
  <HStack spacing={1.5}>
    <>{children}</>
    <Badge
      aria-hidden="true"
      fontFamily="Sinter"
      bg={useColorModeValue("whiteAlpha.300", "blackAlpha.300")}
      color={useColorModeValue("white", "black")}
    >
      ⏎
    </Badge>
  </HStack>
);

export default EnterKeyButtonLabel;

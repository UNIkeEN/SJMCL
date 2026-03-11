import {
  Box,
  Button,
  Code,
  Collapse,
  HStack,
  Icon,
  Spinner,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCheck,
  LuChevronDown,
  LuChevronUp,
  LuX,
  LuZap,
} from "react-icons/lu";
import { useFunctionCall } from "@/contexts/function-call";

// Interface for the function call parameters
export interface FunctionCallParams {
  name: string;
  params: Record<string, any>;
  result?: string;
}

export const FunctionCallWidget: React.FC<{
  data: FunctionCallParams;
  callId?: string;
}> = ({ data, callId }) => {
  const { t } = useTranslation();
  const bgColor = useColorModeValue("purple.50", "purple.900");
  const borderColor = useColorModeValue("purple.200", "purple.700");
  const textColor = useColorModeValue("purple.800", "purple.100");
  const codeBgColor = useColorModeValue("whiteAlpha.500", "blackAlpha.400");
  const { getCallState } = useFunctionCall();

  const [isOpen, setIsOpen] = useState(false);

  // Get state from context if callId is available
  const contextState = callId ? getCallState(callId) : null;

  // Fallback to data.result if no context state (e.g. historical messages)
  const result = contextState?.result || data.result;
  const error = contextState?.error;
  const isLoading = contextState?.isExecuting || false;

  return (
    <Box
      w="full"
      h="full"
      mt={2}
      p={3}
      borderRadius="xl"
      borderWidth="1px"
      bg={bgColor}
      borderColor={borderColor}
    >
      <HStack justify="space-between">
        <HStack>
          <Icon as={LuZap} color={textColor} />
          <Text fontWeight="bold" fontSize="xs" color={textColor}>
            {t("AgentChatPage.functionCall.title")}: {data.name}
          </Text>
        </HStack>
        {isLoading ? (
          <Spinner size="xs" />
        ) : (
          <Icon
            as={error ? LuX : LuCheck}
            color={error ? "red.500" : "green.500"}
          />
        )}
      </HStack>
      {Object.keys(data.params).length > 0 && (
        <Code
          mt={2}
          display="block"
          whiteSpace="pre-wrap"
          fontSize="2xs"
          p={2}
          borderRadius="md"
          bg={codeBgColor}
        >
          {JSON.stringify(data.params, null, 2)}
        </Code>
      )}
      {(result || error) && (
        <Box mt={2}>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setIsOpen(!isOpen)}
            rightIcon={isOpen ? <LuChevronUp /> : <LuChevronDown />}
            w="full"
            justifyContent="space-between"
            color={textColor}
            fontSize="2xs"
          >
            {error
              ? t("AgentChatPage.functionCall.error")
              : t("AgentChatPage.functionCall.result")}
          </Button>
          <Collapse in={isOpen} animateOpacity>
            <Code
              mt={1}
              display="block"
              whiteSpace="pre-wrap"
              fontSize="2xs"
              p={2}
              borderRadius="md"
              bg={codeBgColor}
              colorScheme={error ? "red" : "green"}
            >
              {error || result}
            </Code>
          </Collapse>
        </Box>
      )}
    </Box>
  );
};

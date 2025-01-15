import {
  Box,
  FormControl,
  FormErrorMessage,
  HStack,
  IconButton,
  Input,
  Text,
  TextProps,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuSquarePen, LuX } from "react-icons/lu";

interface EditableProps extends TextProps {
  isTextArea: boolean;
  value: string;
  onEditSubmit: (value: string) => void;
  localeKey?: string;
  placeholder?: string;
  textareaWidth?: string;
  checkError?: (value: string) => number;
  onFocus?: () => void;
  onBlur?: () => void;
}

const Editable: React.FC<EditableProps> = ({
  isTextArea,
  value,
  onEditSubmit,
  localeKey,
  placeholder = "",
  textareaWidth = "sm",
  checkError = () => 0,
  onFocus = () => {},
  onBlur = () => {},
  ...textProps
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const { t } = useTranslation();

  const EditButtons = () => {
    return isEditing ? (
      <HStack ml="auto">
        <IconButton
          icon={<LuCheck />}
          size="sm"
          aria-label="submit"
          onClick={() => {
            if (isInvalid) return;
            if (tempValue !== value) onEditSubmit(tempValue);
            setIsEditing(false);
          }}
        />
        <IconButton
          icon={<LuX />}
          size="sm"
          aria-label="cancel"
          onClick={() => {
            setTempValue(value);
            setIsEditing(false);
            setIsInvalid(false);
          }}
        />
      </HStack>
    ) : (
      <IconButton
        icon={<LuSquarePen />}
        size="sm"
        aria-label="edit"
        onClick={() => {
          setTempValue(value);
          setIsEditing(true);
        }}
        ml="2"
      />
    );
  };

  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  return (
    <Box>
      {isEditing ? (
        isTextArea ? (
          <FormControl pb={5} isInvalid={isInvalid}>
            <Textarea
              ref={ref as React.RefObject<HTMLTextAreaElement>}
              value={tempValue}
              placeholder={placeholder}
              onChange={(e) => {
                setTempValue(e.target.value);
              }}
              onBlur={() => {
                const error = checkError(tempValue);
                setIsInvalid(error !== 0);
                onBlur();
              }}
              onFocus={() => {
                setIsInvalid(false);
                onFocus();
              }}
            />
            <HStack>
              <FormErrorMessage>
                {localeKey &&
                  (isInvalid
                    ? t(`${localeKey}.error-${checkError(tempValue)}`)
                    : "")}
              </FormErrorMessage>
              <Box mt="2" ml="auto">
                {EditButtons()}
              </Box>
            </HStack>
          </FormControl>
        ) : (
          <FormControl isInvalid={isInvalid}>
            <HStack>
              <Input
                ref={ref as React.RefObject<HTMLInputElement>}
                value={tempValue}
                placeholder={placeholder}
                onChange={(e) => {
                  setTempValue(e.target.value);
                }}
                onBlur={() => {
                  const error = checkError(tempValue);
                  setIsInvalid(error !== 0);
                  onBlur();
                }}
                onFocus={() => {
                  setIsInvalid(false);
                  onFocus();
                }}
              />
              {EditButtons()}
            </HStack>
            <FormErrorMessage>
              {localeKey &&
                (isInvalid
                  ? t(`${localeKey}.error-${checkError(tempValue)}`)
                  : "")}
            </FormErrorMessage>
          </FormControl>
        )
      ) : isTextArea ? (
        <HStack>
          <Text
            {...textProps}
            maxW={textareaWidth}
            wordBreak="break-all"
            whiteSpace="pre-wrap"
          >
            {value}
          </Text>
          {EditButtons()}
        </HStack>
      ) : (
        <HStack spacing={0}>
          <Text {...textProps}>{value}</Text>
          {EditButtons()}
        </HStack>
      )}
    </Box>
  );
};

export default Editable;

import {
  Box,
  BoxProps,
  FormControl,
  FormErrorMessage,
  HStack,
  IconButton,
  Input,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuSquarePen, LuX } from "react-icons/lu";

type CombinedProps = Omit<BoxProps, "color"> &
  Omit<
    React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>,
    "color"
  >;

interface EditableProps extends CombinedProps {
  isTextArea: boolean;
  value: string;
  onEditSubmit: (value: string) => void;
  localeKey?: string;
  placeholder?: string;
  textareaWidth?: string;
  checkError?: (value: string) => number;
  onFocus?: () => void;
  onBlur?: () => void;
  textProps?: any;
  inputProps?: any;
}

const Editable: React.FC<EditableProps> = (props) => {
  const {
    isTextArea,
    value,
    onEditSubmit,
    localeKey,
    placeholder = "",
    textareaWidth = "sm",
    checkError = () => 0,
    onFocus = () => {},
    onBlur = () => {},
    textProps = {},
    inputProps = {},
    ...boxProps
  } = props;

  const [isEditing, setIsEditing] = useState(false);
  const [isInvalid, setIsInvalid] = useState(true);
  const [tempValue, setTempValue] = useState(value);

  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const { t } = useTranslation();

  const EditButtons = () => {
    return isEditing ? (
      <HStack ml="auto">
        <IconButton
          variant="subtle"
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
          variant="subtle"
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
        variant="subtle"
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
    if (isEditing) {
      ref.current?.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setTempValue(value);
    setIsInvalid(checkError(value) !== 0);
  }, [value, checkError]);

  return (
    <Box {...boxProps}>
      {isEditing ? (
        isTextArea ? (
          <FormControl pb={5} isInvalid={isInvalid && isEditing}>
            <Textarea
              ref={ref}
              value={tempValue}
              placeholder={placeholder}
              onChange={(e) => {
                setTempValue(e.target.value);
              }}
              onBlur={() => {
                setIsInvalid(checkError(tempValue) !== 0);
                onBlur();
              }}
              onFocus={() => {
                setIsInvalid(false);
                onFocus();
              }}
              {...inputProps}
            />
            <VStack>
              <FormErrorMessage>
                {localeKey && isInvalid && isEditing
                  ? t(`${localeKey}.error-${checkError(tempValue)}`)
                  : ""}
              </FormErrorMessage>
              <Box mt="2" ml="auto">
                {EditButtons()}
              </Box>
            </VStack>
          </FormControl>
        ) : (
          <FormControl isInvalid={isInvalid && isEditing}>
            <HStack>
              <Input
                ref={ref}
                value={tempValue}
                placeholder={placeholder}
                onChange={(e) => {
                  setTempValue(e.target.value);
                }}
                onBlur={() => {
                  setIsInvalid(checkError(tempValue) !== 0);
                  onBlur();
                }}
                onFocus={() => {
                  setIsInvalid(false);
                  onFocus();
                }}
                {...inputProps}
              />
              {EditButtons()}
            </HStack>
            <FormErrorMessage>
              {localeKey && isInvalid && isEditing
                ? t(`${localeKey}.error-${checkError(tempValue)}`)
                : ""}
            </FormErrorMessage>
          </FormControl>
        )
      ) : (
        <HStack w="100%" align="start">
          {isTextArea ? (
            <Text
              maxW={textareaWidth}
              wordBreak="break-all"
              whiteSpace="pre-wrap"
              {...textProps}
            >
              {value}
            </Text>
          ) : (
            <Text {...textProps}>{value}</Text>
          )}
          {EditButtons()}
        </HStack>
      )}
    </Box>
  );
};

export default Editable;

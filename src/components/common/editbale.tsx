import {
  Box,
  BoxProps,
  FormControl,
  FormErrorMessage,
  HStack,
  IconButton,
  Input,
  Text,
  TextProps,
  Textarea,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuSquarePen, LuX } from "react-icons/lu";

interface EditableProps extends BoxProps {
  isTextArea: boolean;
  value: string;
  onEditSubmit: (value: string) => void;
  localeKey?: string;
  placeholder?: string;
  textareaWidth?: string;
  checkError?: (value: string) => number;
  onFocus?: () => void;
  onBlur?: () => void;
  textProps?: TextProps;
  inputProps?: Omit<
    React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> &
      React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    "size"
  > &
    BoxProps;
  formControlProps?: Omit<
    React.ComponentProps<typeof FormControl>,
    "isInvalid"
  >;
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
    formControlProps = {},
    ...boxProps
  } = props;

  const [isEditing, setIsEditing] = useState(false);
  const [isInvalid, setIsInvalid] = useState(true);
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
          <FormControl pb={5} isInvalid={isInvalid} {...formControlProps}>
            <Textarea
              ref={ref}
              value={tempValue}
              placeholder={placeholder}
              onChange={(e) => {
                setTempValue(e.target.value);
                setIsInvalid(checkError(e.target.value) !== 0);
              }}
              onBlur={onBlur}
              onFocus={onFocus}
              {...inputProps}
            />
            <HStack>
              <FormErrorMessage>
                {localeKey && isInvalid
                  ? t(`${localeKey}.error-${checkError(tempValue)}`)
                  : ""}
              </FormErrorMessage>
              <Box mt="2" ml="auto">
                {EditButtons()}
              </Box>
            </HStack>
          </FormControl>
        ) : (
          <FormControl isInvalid={isInvalid} {...formControlProps}>
            <HStack>
              <Input
                ref={ref}
                value={tempValue}
                placeholder={placeholder}
                onChange={(e) => {
                  setTempValue(e.target.value);
                  setIsInvalid(checkError(e.target.value) !== 0);
                }}
                onBlur={onBlur}
                onFocus={onFocus}
                {...inputProps}
              />
              {EditButtons()}
            </HStack>
            <FormErrorMessage>
              {localeKey && isInvalid
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

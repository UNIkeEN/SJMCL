import {
  Box,
  BoxProps,
  FormControl,
  FormErrorMessage,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuSquarePen, LuX } from "react-icons/lu";

interface EditableProps extends BoxProps {
  isTextArea: boolean;
  value: string;
  onEditSubmit: (value: string) => void;
  localeKey?: string;
  // If use the default editable localeKey, error-1 :empty, error-2: too long
  placeholder?: string;
  checkError?: (value: string) => number;
  // default：always return zero (no check)
  onFocus?: () => void;
  onBlur?: () => void;
  inputProps?: React.InputHTMLAttributes<
    HTMLInputElement | HTMLTextAreaElement
  >;
  textProps?: React.HTMLAttributes<HTMLDivElement>;
}

const Editable: React.FC<EditableProps> = ({
  isTextArea,
  value,
  onEditSubmit,
  localeKey = "default.localekey",
  placeholder = "",
  checkError = () => 0,
  onFocus = () => {},
  onBlur = () => {},
  inputProps = {},
  textProps = {},
  ...boxProps
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isInvalid, setIsInvalid] = useState(true);
  const [tempValue, setTempValue] = useState(value);

  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
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
      if (ref.current) {
        ref.current.focus();
      }
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
            <Input
              as="textarea"
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
              w="100%"
            />
            <HStack>
              <FormErrorMessage>
                {localeKey &&
                  (isInvalid && isEditing
                    ? t(`${localeKey}.error-${checkError(tempValue)}`)
                    : "")}
              </FormErrorMessage>
              <Box mt="2" ml="auto">
                {EditButtons()}
              </Box>
            </HStack>
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
                w="100%"
              />
              {EditButtons()}
            </HStack>
            <FormErrorMessage>
              {localeKey &&
                (isInvalid && isEditing
                  ? t(`${localeKey}.error-${checkError(tempValue)}`)
                  : "")}
            </FormErrorMessage>
          </FormControl>
        )
      ) : isTextArea ? (
        <Text
          wordBreak="break-all"
          whiteSpace="pre-wrap"
          w="100%"
          {...textProps}
        >
          {value}
          {EditButtons()}
        </Text>
      ) : (
        <HStack spacing={0}>
          <Text w="100%">{value}</Text>
          {EditButtons()}
        </HStack>
      )}
    </Box>
  );
};

export default Editable;

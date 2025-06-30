import {
  Box,
  BoxProps,
  FormControl,
  FormErrorMessage,
  FormErrorMessageProps,
  HStack,
  IconButton,
  Input,
  InputProps,
  Text,
  TextProps,
  Textarea,
  TextareaProps,
  Tooltip,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuPenLine, LuX } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";

interface EditableProps extends BoxProps {
  isTextArea: boolean;
  value: string;
  onEditSubmit: (value: string) => void;
  localeKey?: string;
  placeholder?: string;
  checkError?: (value: string) => number;
  onFocus?: () => void;
  onBlur?: () => void;
  textProps?: TextProps;
  inputProps?: InputProps | TextareaProps;
  formErrMsgProps?: FormErrorMessageProps;
}

const Editable: React.FC<EditableProps> = ({
  isTextArea,
  value,
  onEditSubmit,
  localeKey,
  placeholder = "",
  checkError = () => 0,
  onFocus = () => {},
  onBlur = () => {},
  textProps = {},
  inputProps = {},
  formErrMsgProps = {},
  ...boxProps
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const ref = useRef<HTMLElement | HTMLInputElement | HTMLTextAreaElement>(
    null
  );
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const EditButtons = () => {
    return isEditing ? (
      <HStack ml="auto">
        <Tooltip label={t("Editable.save")}>
          <IconButton
            icon={<LuCheck />}
            size="xs"
            variant="ghost"
            h={18}
            aria-label="submit"
            isDisabled={checkError(tempValue) !== 0}
            onClick={() => {
              if (checkError(tempValue)) return;
              if (tempValue !== value) onEditSubmit(tempValue);
              setIsEditing(false);
            }}
          />
        </Tooltip>

        <Tooltip label={t("Editable.cancel")}>
          <IconButton
            icon={<LuX />}
            size="xs"
            variant="ghost"
            h={18}
            aria-label="cancel"
            onClick={() => {
              setTempValue(value);
              setIsEditing(false);
            }}
          />
        </Tooltip>
      </HStack>
    ) : (
      <Tooltip label={t("Editable.edit")}>
        <IconButton
          icon={<LuPenLine />}
          size="xs"
          variant="ghost"
          h={18}
          aria-label="edit"
          onClick={() => {
            setTempValue(value);
            setIsEditing(true);
          }}
          ml="2"
        />
      </Tooltip>
    );
  };

  useEffect(() => {
    if (isEditing && ref.current) {
      (ref.current as HTMLInputElement | HTMLTextAreaElement).focus();
    }
  }, [isEditing]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (checkError(tempValue)) return;

      if (tempValue !== value) onEditSubmit(tempValue);
      setIsEditing(false);
    }
  };

  return (
    <Box {...boxProps}>
      {isEditing ? (
        isTextArea ? (
          <FormControl
            pb={5}
            isInvalid={checkError(tempValue) !== 0 && isEditing}
          >
            <Textarea
              ref={ref as React.RefObject<HTMLTextAreaElement>}
              value={tempValue}
              placeholder={placeholder}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={onBlur}
              onFocus={onFocus}
              onKeyDown={onKeyDown}
              focusBorderColor={`${primaryColor}.500`}
              {...(inputProps as TextareaProps)}
            />
            <HStack>
              <FormErrorMessage {...formErrMsgProps}>
                {localeKey &&
                  (checkError(tempValue) && isEditing
                    ? t(`${localeKey}.error-${checkError(tempValue)}`)
                    : "")}
              </FormErrorMessage>
              <Box mt="2" ml="auto">
                {EditButtons()}
              </Box>
            </HStack>
          </FormControl>
        ) : (
          <FormControl isInvalid={checkError(tempValue) !== 0 && isEditing}>
            <HStack>
              <Input
                ref={ref as React.RefObject<HTMLInputElement>}
                value={tempValue}
                placeholder={placeholder}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={onBlur}
                onFocus={onFocus}
                onKeyDown={onKeyDown}
                focusBorderColor={`${primaryColor}.500`}
                {...(inputProps as InputProps)}
              />
              {EditButtons()}
            </HStack>
            <FormErrorMessage {...formErrMsgProps}>
              {localeKey &&
                (checkError(tempValue) && isEditing
                  ? t(`${localeKey}.error-${checkError(tempValue)}`)
                  : "")}
            </FormErrorMessage>
          </FormControl>
        )
      ) : isTextArea ? (
        <Text
          w="100%"
          wordBreak="break-all"
          whiteSpace="pre-wrap"
          {...textProps}
        >
          {value}
          {EditButtons()}
        </Text>
      ) : (
        <HStack spacing={0}>
          <Text w="100%" {...textProps}>
            {value}
          </Text>
          {EditButtons()}
        </HStack>
      )}
    </Box>
  );
};

export default Editable;

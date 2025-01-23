import {
  Box,
  BoxProps,
  FormControl,
  FormErrorMessage,
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
  ...boxProps
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isInvalid, setIsInvalid] = useState(true);
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
            onClick={() => {
              if (isInvalid) return;
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
              setIsInvalid(false);
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

  return (
    <Box {...boxProps}>
      {isEditing ? (
        isTextArea ? (
          <FormControl pb={5} isInvalid={isInvalid && isEditing}>
            <Textarea
              ref={ref as React.RefObject<HTMLTextAreaElement>}
              value={tempValue}
              placeholder={placeholder}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={() => {
                setIsInvalid(checkError(tempValue) !== 0);
                onBlur();
              }}
              onFocus={() => {
                setIsInvalid(false);
                onFocus();
              }}
              focusBorderColor={`${primaryColor}.500`}
              {...(inputProps as TextareaProps)}
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
                ref={ref as React.RefObject<HTMLInputElement>}
                value={tempValue}
                placeholder={placeholder}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={() => {
                  setIsInvalid(checkError(tempValue) !== 0);
                  onBlur();
                }}
                onFocus={() => {
                  setIsInvalid(false);
                  onFocus();
                }}
                focusBorderColor={`${primaryColor}.500`}
                {...(inputProps as InputProps)}
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

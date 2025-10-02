import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";

interface ManualJavaPathModalProps extends Omit<ModalProps, "children"> {
  onSubmit: (javaPath: string) => void;
}

const ManualJavaPathModal: React.FC<ManualJavaPathModalProps> = ({
  onSubmit,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { isOpen, onClose } = modalProps;
  const initialRef = useRef<HTMLInputElement>(null);

  const [javaPath, setJavaPath] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setJavaPath("");
      setError("");
    }
  }, [isOpen]);

  const validateJavaPath = (path: string): string => {
    if (!path.trim()) {
      return t("ManualJavaPathModal.error.empty");
    }

    const fileName = path.split(/[/\\]/).pop();
    const isValidFileName =
      config.basicInfo.platform === "windows"
        ? fileName === "java.exe"
        : fileName === "java";

    if (!isValidFileName) {
      return t("ManualJavaPathModal.error.invalidFileName");
    }

    return "";
  };

  const handleSubmit = () => {
    const validationError = validateJavaPath(javaPath);
    if (validationError) {
      setError(validationError);
      return;
    }

    onSubmit(javaPath.trim());
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setJavaPath(value);
    if (error) {
      setError("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <Modal {...modalProps} initialFocusRef={initialRef} isCentered size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("ManualJavaPathModal.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Text fontSize="sm" color="gray.600">
              {t("ManualJavaPathModal.description")}
            </Text>
            <FormControl isInvalid={!!error}>
              <FormLabel fontSize="sm">
                {t("ManualJavaPathModal.pathLabel")}
              </FormLabel>
              <Input
                ref={initialRef}
                value={javaPath}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder={
                  config.basicInfo.platform === "windows"
                    ? "C:\\Program Files\\Java\\jdk-17\\bin\\java.exe"
                    : "/usr/bin/java"
                }
                focusBorderColor={`${primaryColor}.500`}
              />
              {error && <FormErrorMessage>{error}</FormErrorMessage>}
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={onClose}>
              {t("ManualJavaPathModal.cancel")}
            </Button>
            <Button
              colorScheme={primaryColor}
              onClick={handleSubmit}
              isDisabled={!javaPath.trim()}
            >
              {t("ManualJavaPathModal.add")}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ManualJavaPathModal;

import {
  Button,
  FormControl,
  FormErrorMessage,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useToast } from "@/contexts/toast";
import { AccountService } from "@/services/account";

interface EditAuthServerNameModalProps extends Omit<ModalProps, "children"> {
  authUrl?: string;
  currentName?: string;
}

const EditAuthServerNameModal: React.FC<EditAuthServerNameModalProps> = ({
  authUrl = "",
  currentName = "",
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { getAuthServerList } = useGlobalData();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { isOpen, onClose } = modalProps;
  const initialRef = useRef<HTMLInputElement>(null);

  const [serverName, setServerName] = useState<string>("");
  const [isTouched, setIsTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const trimmedName = serverName.trim();
  const isNameInvalid = isTouched && !trimmedName;

  useEffect(() => {
    if (isOpen) {
      setServerName(currentName);
      setIsTouched(false);
    }
  }, [isOpen, currentName]);

  const handleSave = () => {
    setIsTouched(true);
    if (!trimmedName) return;

    setIsLoading(true);
    AccountService.updateAuthServerName(authUrl, trimmedName)
      .then((response) => {
        if (response.status === "success") {
          getAuthServerList(true);
          toast({
            title: response.message,
            status: "success",
          });
          onClose?.();
        } else {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <Modal
      size={{ base: "sm", md: "md" }}
      initialFocusRef={initialRef}
      returnFocusOnClose={false}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("EditAuthServerNameModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl isInvalid={isNameInvalid} isRequired>
            <Input
              ref={initialRef}
              value={serverName}
              placeholder={t("EditAuthServerNameModal.placeholder.name")}
              onChange={(e) => setServerName(e.target.value)}
              onBlur={() => setIsTouched(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
              focusBorderColor={`${primaryColor}.500`}
            />
            {isNameInvalid && (
              <FormErrorMessage>
                {t("EditAuthServerNameModal.error.nameRequired")}
              </FormErrorMessage>
            )}
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            colorScheme={primaryColor}
            onClick={handleSave}
            isLoading={isLoading}
            isDisabled={!trimmedName}
          >
            {t("General.save")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default EditAuthServerNameModal;

import {
  Button,
  FormControl,
  FormLabel,
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
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";

const ReLogin3rdPartyPlayerModal: React.FC<
  Omit<ModalProps, "children"> & {
    username: string;
    onReLogin: (password: string) => void;
  }
> = ({ username, onReLogin, ...props }) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [password, setPassword] = useState<string>("");

  const handleReLogin = async () => {
    onReLogin(password);
    setPassword("");
    props.onClose();
  };

  return (
    <Modal {...props}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("ReLogin3rdPartyPlayerModal.modal.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={3.5} align="flex-start">
            <FormControl>
              <FormLabel>
                {t("ReLogin3rdPartyPlayerModal.label.user")}
              </FormLabel>
              <Text>{username}</Text>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>
                {t("ReLogin3rdPartyPlayerModal.label.password")}
              </FormLabel>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t(
                  "ReLogin3rdPartyPlayerModal.placeholder.password"
                )}
                focusBorderColor={`${primaryColor}.500`}
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={props.onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            colorScheme={primaryColor}
            onClick={handleReLogin}
            isDisabled={!password.trim()}
          >
            {t("ReLogin3rdPartyPlayerModal.button.login")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ReLogin3rdPartyPlayerModal;

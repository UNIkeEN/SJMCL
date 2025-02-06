import {
  Button,
  FormControl,
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
  Text,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";

interface ReLogin3rdPartyPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  onReLogin: (password: string) => void;
}

const ReLogin3rdPartyPlayerModal: React.FC<ReLogin3rdPartyPlayerModalProps> = ({
  isOpen,
  onClose,
  username,
  onReLogin,
}) => {
  const [password, setPassword] = useState<string>("");
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const handleReLogin = async () => {
    onReLogin(password);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("reloginPlayerModal.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <HStack>
            <Text fontWeight={500}>{t("reloginPlayerModal.user")}</Text>
            <Text>{username}</Text>
          </HStack>
          <FormControl isRequired>
            <FormLabel>{t("reloginPlayerModal.password")}</FormLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("reloginPlayerModal.input")}
            />
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" mr={2} onClick={onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            colorScheme={primaryColor}
            onClick={handleReLogin}
            isDisabled={!password.trim()}
          >
            {t("reloginPlayerModal.relogin")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ReLogin3rdPartyPlayerModal;

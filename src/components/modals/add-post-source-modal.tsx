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
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";

const AddDiscoverSourceModal: React.FC<Omit<ModalProps, "children">> = ({
  ...props
}) => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const [endpointUrl, setEndpointUrl] = useState<string>("");

  const handleCloseModal = () => {
    setEndpointUrl("");
    props.onClose();
  };

  const handleConfirm = () => {
    const trimmed = endpointUrl.trim();
    const current = config.discoverSourceEndpoints;
    if (!trimmed || current.some(([url]) => url === trimmed)) return;
    const updated = [...current, [trimmed, true]];
    update("discoverSourceEndpoints", updated);
    handleCloseModal();
  };

  return (
    <Modal {...props} onClose={handleCloseModal}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("AddDiscoverSourceModal.modal.header")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl isRequired>
            <FormLabel>
              {t("AddDiscoverSourceModal.label.endpointUrl")}
            </FormLabel>
            <Input
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder={t("AddDiscoverSourceModal.placeholder.endpointUrl")}
              focusBorderColor={`${primaryColor}.500`}
              required
            />
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={props.onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            colorScheme={primaryColor}
            onClick={handleConfirm}
            isDisabled={!endpointUrl.trim()}
          >
            {t("General.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddDiscoverSourceModal;

import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { ImportLauncherType } from "@/enums/account";

const ImportAccountInfoModal: React.FC<Omit<ModalProps, "children">> = ({
  ...props
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const importLauncherTypes = [
    ImportLauncherType.HMCL,
    ...(config.basicInfo.osType === "windows" ? [ImportLauncherType.PCL] : []),
    ...(config.basicInfo.osType === "macos" ? [ImportLauncherType.SCL] : []),
  ];

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      {...props}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("ImportAccountInfoModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody></ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={props.onClose}>
            {t("General.cancel")}
          </Button>
          <Button colorScheme={primaryColor}>{t("General.import")}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ImportAccountInfoModal;

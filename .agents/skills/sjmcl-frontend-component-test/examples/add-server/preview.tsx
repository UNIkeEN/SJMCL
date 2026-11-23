import { Button, useDisclosure } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import AddGameServerModal from "@/components/modals/add-game-server-modal";

export default function Preview() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { t } = useTranslation();

  return (
    <>
      <Button onClick={onOpen}>{t("AddGameServerModal.header.title")}</Button>
      <AddGameServerModal
        instanceId="preview-instance"
        isOpen={isOpen}
        onClose={onClose}
      />
    </>
  );
}

import {
  Button,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GameVersionSelector } from "@/components/game-version-selector";
import { useLauncherConfig } from "@/contexts/config";
import { GameResourceInfo } from "@/models/resource";

export const DownloadGameServerModal: React.FC<
  Omit<ModalProps, "children">
> = ({ ...modalProps }) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [selectedGameVersion, setSelectedGameVersion] =
    useState<GameResourceInfo>();

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
        <ModalHeader>
          {t("AddAndImportInstancePage.moreOptions.server.title")}
        </ModalHeader>
        <ModalCloseButton />
        <Flex flexGrow="1" flexDir="column">
          <ModalBody>
            <GameVersionSelector
              selectedVersion={selectedGameVersion}
              onVersionSelect={setSelectedGameVersion}
            />
          </ModalBody>
          <ModalFooter mt={1}>
            <Button variant="ghost" onClick={modalProps.onClose}>
              {t("General.cancel")}
            </Button>
            <Button
              disabled={!selectedGameVersion}
              colorScheme={primaryColor}
              onClick={modalProps.onClose}
            >
              {t("General.finish")}
            </Button>
          </ModalFooter>
        </Flex>
      </ModalContent>
    </Modal>
  );
};

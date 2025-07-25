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
import { save } from "@tauri-apps/plugin-dialog";
import { useRouter } from "next/router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GameVersionSelector } from "@/components/game-version-selector";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { GameResourceInfo } from "@/models/resource";
import { ResourceService } from "@/services/resource";

export const DownloadGameServerModal: React.FC<
  Omit<ModalProps, "children">
> = ({ ...modalProps }) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const toast = useToast();
  const router = useRouter();
  const primaryColor = config.appearance.theme.primaryColor;

  const [selectedGameVersion, setSelectedGameVersion] =
    useState<GameResourceInfo>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleDownloadGameServer = async () => {
    if (!selectedGameVersion) return;

    const savepath = await save({
      defaultPath: `${selectedGameVersion.id}-server.jar`,
    });
    if (!savepath || !selectedGameVersion?.url) return;

    setIsLoading(true);
    const response = await ResourceService.downloadGameServer(
      selectedGameVersion,
      savepath
    );
    setIsLoading(false);
    if (response.status === "success") {
      // success toast will now be called by task context group listener
      modalProps.onClose?.();
      router.push("/downloads");
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
      modalProps.onClose?.();
    }
    setSelectedGameVersion(undefined);
  };

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
              onClick={() => handleDownloadGameServer()}
              isLoading={isLoading}
            >
              {t("General.finish")}
            </Button>
          </ModalFooter>
        </Flex>
      </ModalContent>
    </Modal>
  );
};

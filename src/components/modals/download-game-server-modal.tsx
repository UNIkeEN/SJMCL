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
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
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
              onClick={async () => {
                if (!selectedGameVersion) return;
                const savepath = await save({
                  title: t("ChooseSaveLocation"),
                  defaultPath: `${selectedGameVersion.id}-server.jar`,
                });
                if (!savepath || !selectedGameVersion?.url) return;

                await invoke("schedule_progressive_task_group", {
                  taskGroup: "game-server-download",
                  params: [
                    {
                      task_type: "Download",
                      src: selectedGameVersion.url,
                      dest: savepath,
                      sha1: "d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2", // 非空字符串！
                    },
                  ],
                });
                modalProps.onClose?.();
              }}
            >
              {t("General.finish")}
            </Button>
          </ModalFooter>
        </Flex>
      </ModalContent>
    </Modal>
  );
};

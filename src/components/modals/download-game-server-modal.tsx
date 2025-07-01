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
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GameVersionSelector } from "@/components/game-version-selector";
import { useLauncherConfig } from "@/contexts/config";
import { useTaskContext } from "@/contexts/task";
import { GameResourceInfo } from "@/models/resource";
import { TaskTypeEnums } from "@/models/task";

export const DownloadGameServerModal: React.FC<
  Omit<ModalProps, "children">
> = ({ ...modalProps }) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { handleScheduleProgressiveTaskGroup } = useTaskContext();

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
                  defaultPath: `${selectedGameVersion.id}-server.jar`,
                });
                if (!savepath || !selectedGameVersion?.url) return;
                handleScheduleProgressiveTaskGroup("game-server-download", [
                  {
                    src: "https://piston-data.mojang.com/v1/objects/15c777e2cfe0556eef19aab534b186c0c6f277e1/server.jar",
                    dest: "1.jar",
                    sha1: "15c777e2cfe0556eef19aab534b186c0c6f277e1",
                    taskType: TaskTypeEnums.Download,
                  },
                ]);
                setSelectedGameVersion(undefined);
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

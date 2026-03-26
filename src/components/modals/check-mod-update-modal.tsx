import {
  Box,
  Button,
  Checkbox,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Progress,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { ModLoaderType } from "@/enums/instance";
import { OtherResourceSource } from "@/enums/resource";
import { InstanceSummary, LocalModInfo } from "@/models/instance/misc";
import {
  ModUpdateQuery,
  ModUpdateRecord,
  OtherResourceFileInfo,
} from "@/models/resource";
import { ResourceService } from "@/services/resource";

interface CheckModUpdateModalProps extends Omit<ModalProps, "children"> {
  summary: InstanceSummary | undefined;
  localMods: LocalModInfo[];
}

const CheckModUpdateModal: React.FC<CheckModUpdateModalProps> = ({
  summary,
  localMods,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const addPrefix =
    config.general.general.language === "zh-Hans" &&
    config.general.functionality.translatedFilenamePrefix;

  const [selectedMods, setSelectedMods] = useState<ModUpdateRecord[]>([]);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(true);
  const [updateList, setUpdateList] = useState<ModUpdateRecord[]>([]);
  const [modsToUpdate, setModsToUpdate] = useState<LocalModInfo[]>([]);
  const [checkingUpdateIndex, setCheckingUpdateIndex] = useState<number>(1);

  const headerBg = useColorModeValue("gray.50", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const hoverBg = useColorModeValue("gray.50", "gray.700");
  const textColor = useColorModeValue("gray.700", "gray.200");
  const secondaryTextColor = useColorModeValue("gray.500", "gray.400");
  const mutedTextColor = useColorModeValue("gray.600", "gray.300");
  const successTextColor = useColorModeValue("green.500", "green.400");

  const handleSelectAll = () => {
    if (selectedMods.length === updateList.length) {
      setSelectedMods([]);
    } else {
      setSelectedMods([...updateList]);
    }
  };

  const handleModToggle = (mod: ModUpdateRecord) => {
    setSelectedMods((prev) => {
      const isSelected = prev.some((m) => m.name === mod.name);
      if (isSelected) {
        return prev.filter((m) => m.name !== mod.name);
      } else {
        return [...prev, mod];
      }
    });
  };

  const onCheckUpdateModalClear = useCallback(() => {
    setIsCheckingUpdate(true);
    setUpdateList([]);
    setModsToUpdate([]);
    setSelectedMods([]);
    setCheckingUpdateIndex(1);
  }, []);

  const handleFetchLatestMod = useCallback(
    async (
      resourceId: string,
      modLoader: ModLoaderType | "All",
      gameVersions: string[],
      downloadSource: OtherResourceSource
    ): Promise<OtherResourceFileInfo | undefined> => {
      try {
        const response = await ResourceService.fetchResourceVersionPacks(
          resourceId,
          modLoader,
          gameVersions,
          downloadSource
        );

        if (response.status === "success") {
          const versionPack = response.data.find(
            (pack) => pack.name === summary?.version
          );

          if (!versionPack) return undefined;

          const candidateFiles = versionPack.items.filter(
            (file) =>
              file.releaseType === "beta" || file.releaseType === "release"
          );

          candidateFiles.sort(
            (a, b) =>
              new Date(b.fileDate).getTime() - new Date(a.fileDate).getTime()
          );

          return candidateFiles[0];
        } else return undefined;
      } catch (error) {
        logger.error("Failed to fetch latest mod:", error);
        return undefined;
      }
    },
    [summary?.version]
  );

  const handleCheckModUpdate = useCallback(async () => {
    const currentSummary = summary;
    const currentLocalMods = localMods;
    onCheckUpdateModalClear();

    try {
      if (!currentSummary?.id || currentLocalMods.length === 0) {
        setIsCheckingUpdate(false);
        return;
      }

      const updatePromises = currentLocalMods.map(async (mod) => {
        try {
          const [cfRemoteModRes, mrRemoteModRes] = await Promise.all([
            ResourceService.fetchRemoteResourceByLocal(
              OtherResourceSource.CurseForge,
              mod.filePath
            ),
            ResourceService.fetchRemoteResourceByLocal(
              OtherResourceSource.Modrinth,
              mod.filePath
            ),
          ]);

          let cfRemoteMod = undefined;
          let mrRemoteMod = undefined;

          if (cfRemoteModRes.status === "success") {
            cfRemoteMod = cfRemoteModRes.data;
          }
          if (mrRemoteModRes.status === "success") {
            mrRemoteMod = mrRemoteModRes.data;
          }

          const updatePromises = [];

          if (cfRemoteMod?.resourceId) {
            updatePromises.push(
              handleFetchLatestMod(
                cfRemoteMod.resourceId,
                mod.loaderType,
                [currentSummary?.majorVersion || "All"],
                OtherResourceSource.CurseForge
              )
            );
          } else {
            updatePromises.push(Promise.resolve(undefined));
          }

          if (mrRemoteMod?.resourceId) {
            updatePromises.push(
              handleFetchLatestMod(
                mrRemoteMod.resourceId,
                mod.loaderType,
                [currentSummary?.version || "All"],
                OtherResourceSource.Modrinth
              )
            );
          } else {
            updatePromises.push(Promise.resolve(undefined));
          }

          const [cfRemoteFile, mrRemoteFile] =
            await Promise.all(updatePromises);

          let isCurseForgeNewer = cfRemoteMod !== undefined;
          if (cfRemoteFile && mrRemoteFile) {
            isCurseForgeNewer =
              new Date(cfRemoteFile.fileDate).getTime() >
              new Date(mrRemoteFile.fileDate).getTime();
          }

          const latestFile = isCurseForgeNewer ? cfRemoteFile : mrRemoteFile;
          const remoteMod = isCurseForgeNewer ? cfRemoteMod : mrRemoteMod;

          let needUpdate = false;
          if (latestFile && remoteMod) {
            needUpdate =
              new Date(latestFile.fileDate).getTime() -
                new Date(remoteMod.fileDate).getTime() >
              0;
          }

          if (needUpdate && latestFile) {
            return {
              mod,
              updateRecord: {
                name: mod.name,
                curVersion: mod.version,
                newVersion: latestFile.name,
                source: isCurseForgeNewer
                  ? OtherResourceSource.CurseForge
                  : OtherResourceSource.Modrinth,
                downloadUrl: latestFile.downloadUrl,
                sha1: latestFile.sha1,
                fileName: latestFile.fileName,
              },
            };
          }
          return null;
        } catch (error) {
          logger.error(`Failed to check update for mod ${mod.name}:`, error);
          return null;
        }
      });

      const results: any[] = [];

      await Promise.allSettled(
        updatePromises.map(async (p) => {
          const res = await p;
          setCheckingUpdateIndex(results.length + 1);
          results.push(res);
        })
      );

      const validUpdates = results.filter(
        (result): result is NonNullable<typeof result> => result !== null
      );

      setModsToUpdate(validUpdates.map((item) => item.mod));
      setUpdateList(validUpdates.map((item) => item.updateRecord));
    } catch (error) {
      logger.error("Failed to check mod updates:", error);
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [summary, localMods, handleFetchLatestMod, onCheckUpdateModalClear]);

  const handleDownloadUpdatedMods = useCallback(
    async (urlShaPairs: { url: string; sha1: string; fileName: string }[]) => {
      let params: ModUpdateQuery[] = [];
      if (summary?.id) {
        for (const pair of urlShaPairs) {
          const { url, sha1, fileName } = pair;
          const oldMod = modsToUpdate.find((mod) =>
            updateList.some(
              (update) =>
                update.fileName === fileName && update.name === mod.name
            )
          );
          if (oldMod) {
            const oldFilePath = oldMod.filePath;
            const finalFileName =
              addPrefix && oldMod.translatedName
                ? `[${oldMod.translatedName}] ${fileName}`
                : fileName;
            params.push({
              url,
              sha1,
              fileName: finalFileName,
              oldFilePath,
            });
          }
        }
        ResourceService.updateMods(summary.id, params);
      }
    },
    [summary?.id, modsToUpdate, updateList, addPrefix]
  );

  useEffect(() => {
    if (modalProps.isOpen && summary?.id && localMods.length > 0) {
      handleCheckModUpdate();
    }
  }, [modalProps.isOpen, summary?.id, localMods.length, handleCheckModUpdate]);

  useEffect(() => {
    if (!modalProps.isOpen) {
      onCheckUpdateModalClear();
    }
  }, [modalProps.isOpen, onCheckUpdateModalClear]);

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
        <ModalHeader>
          <HStack w="100%" justify="flex-start" align="center">
            <Text>{t("CheckModUpdateModal.header.title")}</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody
          flex="1"
          display="flex"
          flexDirection="column"
          overflow="hidden"
        >
          {isCheckingUpdate ? (
            <VStack spacing={4} justify="center" align="center" h="75%">
              <Text fontSize="md" color={textColor}>
                {t("CheckModUpdateModal.label.loading", {
                  x: checkingUpdateIndex,
                  y: localMods.length,
                })}
              </Text>
              <Progress
                value={
                  localMods.length > 0
                    ? (checkingUpdateIndex / localMods.length) * 100
                    : 0
                }
                size="md"
                colorScheme={primaryColor}
                w="80%"
                borderRadius="md"
              />
            </VStack>
          ) : updateList.length === 0 ? (
            <VStack mt={8}>
              <Text color={secondaryTextColor}>
                {t("CheckModUpdateModal.label.noUpdate")}
              </Text>
            </VStack>
          ) : (
            <VStack spacing={0} align="stretch" flex="1" overflow="hidden">
              <HStack
                py={3}
                px={4}
                bg={headerBg}
                borderRadius="md"
                borderBottomRadius="none"
                border="1px"
                borderColor={borderColor}
                fontSize="sm"
                flexShrink={0}
              >
                <Checkbox
                  isChecked={
                    selectedMods.length === updateList.length &&
                    updateList.length > 0
                  }
                  isIndeterminate={
                    selectedMods.length > 0 &&
                    selectedMods.length < updateList.length
                  }
                  onChange={handleSelectAll}
                  colorScheme={primaryColor}
                />
                <Box flex="2" minW="0">
                  <Text textAlign="center">
                    {t("CheckModUpdateModal.updateList.mod")}
                  </Text>
                </Box>
                <Box flex="2" minW="0">
                  <Text textAlign="center">
                    {t("CheckModUpdateModal.updateList.currentVersion")}
                  </Text>
                </Box>
                <Box flex="3" minW="0">
                  <Text textAlign="center">
                    {t("CheckModUpdateModal.updateList.latestVersion")}
                  </Text>
                </Box>
                <Box flex="1" minW="0">
                  <Text textAlign="center">
                    {t("CheckModUpdateModal.updateList.source")}
                  </Text>
                </Box>
              </HStack>

              <Box
                flex="1"
                overflowY="auto"
                border="1px"
                borderColor={borderColor}
                borderTop="none"
                borderRadius="md"
                borderTopRadius="none"
              >
                <VStack spacing={0} align="stretch">
                  {updateList.map((mod, index) => (
                    <HStack
                      key={mod.fileName} // unique
                      py={3}
                      px={4}
                      borderBottom={
                        index === updateList.length - 1 ? "none" : "1px"
                      }
                      borderColor={borderColor}
                      _hover={{ bg: hoverBg }}
                      cursor="pointer"
                      onClick={() => handleModToggle(mod)}
                    >
                      <Checkbox
                        isChecked={selectedMods.some(
                          (m) => m.name === mod.name
                        )}
                        onChange={() => handleModToggle(mod)}
                        colorScheme={primaryColor}
                      />
                      <Box flex="2" minW="0">
                        <Text
                          fontSize="xs"
                          noOfLines={1}
                          title={mod.name || mod.fileName}
                          textAlign="center"
                        >
                          {mod.name || mod.fileName}
                        </Text>
                      </Box>
                      <Box flex="2" minW="0">
                        <Text
                          fontSize="xs"
                          color={mutedTextColor}
                          noOfLines={1}
                          title={mod.curVersion || mod.fileName}
                          textAlign="center"
                        >
                          {mod.curVersion || mod.fileName}
                        </Text>
                      </Box>
                      <Box flex="3" minW="0">
                        <Text
                          fontSize="xs"
                          color={successTextColor}
                          noOfLines={1}
                          title={mod.newVersion}
                          textAlign="center"
                        >
                          {mod.newVersion}
                        </Text>
                      </Box>
                      <Box flex="1" minW="0">
                        <Text
                          fontSize="xs"
                          color={secondaryTextColor}
                          noOfLines={1}
                          title={mod.source}
                          textAlign="center"
                        >
                          {mod.source}
                        </Text>
                      </Box>
                    </HStack>
                  ))}
                </VStack>
              </Box>
            </VStack>
          )}
        </ModalBody>

        {!isCheckingUpdate && updateList.length > 0 && (
          <ModalFooter flexShrink={0}>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={modalProps.onClose}>
                {t("CheckModUpdateModal.button.cancel")}
              </Button>
              <Button
                colorScheme={primaryColor}
                onClick={() => {
                  handleDownloadUpdatedMods(
                    selectedMods.map((mod) => ({
                      url: mod.downloadUrl,
                      sha1: mod.sha1,
                      fileName: mod.fileName,
                    }))
                  );
                  modalProps.onClose?.();
                }}
                isDisabled={selectedMods.length === 0}
              >
                {t("CheckModUpdateModal.button.update")}
              </Button>
            </HStack>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
};

export default CheckModUpdateModal;

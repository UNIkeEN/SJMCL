import {
  Avatar,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  ModalProps,
  Tag,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuExternalLink } from "react-icons/lu";
import { OptionItem } from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { useSharedModals } from "@/contexts/shared-modal";
import { ModLoaderType } from "@/enums/instance";
import { OtherResourceType } from "@/enums/resource";
import { LocalModInfo } from "@/models/instance/misc";
import { ResourceService } from "@/services/resource";
import { base64ImgSrc } from "@/utils/string";

interface ModInfoModalProps extends Omit<ModalProps, "children"> {
  mod: LocalModInfo;
}

const ModInfoModal: React.FC<ModInfoModalProps> = ({ mod, ...modalProps }) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { openSharedModal } = useSharedModals();

  const [cfRemoteModId, setCfRemoteModId] = useState<string | null>(null);
  const [mrRemoteModId, setMrRemoteModId] = useState<string | null>(null);

  const openDownloadModal = (downloadSource: string) => {
    openSharedModal("download-specific-resource", {
      resource: {
        id: downloadSource === "CurseForge" ? cfRemoteModId : mrRemoteModId,
        websiteUrl: "",
        type: OtherResourceType.Mod,
        name: mod.name || mod.fileName,
        translatedName: mod.translatedName,
        description: mod.description || "",
        iconSrc: base64ImgSrc(mod.iconSrc),
        tags: [],
        lastUpdated: "",
        downloads: 0,
        source: downloadSource,
      },
      curInstanceMajorVersion: undefined,
      curInstanceVersion: undefined,
      curInstanceModLoader: mod.loaderType,
    });
  };

  const handleCurseForgeInfo = useCallback(async () => {
    ResourceService.fetchRemoteResourceByLocal("CurseForge", mod.filePath).then(
      (response) => {
        if (response.status === "success") {
          const modId = response.data.resourceId;
          setCfRemoteModId(modId);
        }
      }
    );
  }, [mod.filePath, setCfRemoteModId]);

  const handleModrinthInfo = useCallback(async () => {
    ResourceService.fetchRemoteResourceByLocal("Modrinth", mod.filePath).then(
      (response) => {
        if (response.status === "success") {
          const modId = response.data.resourceId;
          setMrRemoteModId(modId);
        }
      }
    );
  }, [mod.filePath, setMrRemoteModId]);

  useEffect(() => {
    setCfRemoteModId(null);
    setMrRemoteModId(null);
    handleCurseForgeInfo();
    handleModrinthInfo();
  }, [
    handleCurseForgeInfo,
    handleModrinthInfo,
    setCfRemoteModId,
    setMrRemoteModId,
  ]);

  return (
    <Modal size={{ base: "md", lg: "lg", xl: "xl" }} {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalBody mt={2}>
          <OptionItem
            title={
              <Text fontWeight="semibold" fontSize="md">
                {mod.translatedName
                  ? `${mod.translatedName} | ${mod.name}`
                  : mod.name || mod.fileName}
              </Text>
            }
            titleExtra={
              <HStack>
                {mod.version && (
                  <Text className="secondary-text">{mod.version}</Text>
                )}
                {mod.loaderType !== ModLoaderType.Unknown && (
                  <Tag colorScheme={primaryColor} className="tag-sm">
                    {mod.loaderType}
                  </Tag>
                )}
              </HStack>
            }
            description={
              <Text fontSize="xs-sm" className="secondary-text">
                {mod.fileName}
              </Text>
            }
            prefixElement={
              <Avatar
                src={base64ImgSrc(mod.iconSrc)}
                name={mod.name || mod.fileName}
                boxSize="40px"
                borderRadius="4px"
                style={{
                  filter: mod.enabled ? "none" : "grayscale(90%)",
                  opacity: mod.enabled ? 1 : 0.5,
                }}
              />
            }
          />
          <Text mt={4}>{mod.description}</Text>
        </ModalBody>

        <ModalFooter w="100%">
          <HStack spacing={3}>
            <HStack spacing={2}>
              <LuExternalLink />
              <Button
                colorScheme={primaryColor}
                onClick={() => {
                  modalProps.onClose();
                  openDownloadModal("CurseForge");
                }}
                fontSize="sm"
                variant="link"
                disabled={!cfRemoteModId}
              >
                CurseForge
              </Button>
            </HStack>
            <HStack spacing={2}>
              <LuExternalLink />
              <Button
                colorScheme={primaryColor}
                onClick={() => {
                  modalProps.onClose();
                  openDownloadModal("Modrinth");
                }}
                fontSize="sm"
                variant="link"
                disabled={!mrRemoteModId}
              >
                Modrinth
              </Button>
            </HStack>
          </HStack>
          <Button
            colorScheme={primaryColor}
            onClick={modalProps.onClose}
            ml="auto"
          >
            {t("General.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ModInfoModal;

import {
  Avatar,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  ModalProps,
  Tag,
  Text,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuExternalLink } from "react-icons/lu";
import { OptionItem } from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { ModLoaderType } from "@/enums/instance";
import { OtherResourceSource } from "@/enums/resource";
import { LocalModInfo } from "@/models/instance/misc";
import { ResourceService } from "@/services/resource";
import { base64ImgSrc } from "@/utils/string";

interface ModInfoModalProps extends Omit<ModalProps, "children"> {
  mod: LocalModInfo;
  curInstanceMajorVersion?: string;
  curInstanceVersion?: string;
}

const ModInfoModal: React.FC<ModInfoModalProps> = ({
  mod,
  curInstanceMajorVersion,
  curInstanceVersion,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const showZhTrans =
    config.general.general.language === "zh-Hans" &&
    config.general.functionality.resourceTranslation;

  const [cfModWebsiteUrl, setCfModWebsiteUrl] = useState<string>("");
  const [mrModWebsiteUrl, setMrModWebsiteUrl] = useState<string>("");
  const [MCModWebsiteUrl, setMCModWebsiteUrl] = useState<string>("");

  const handleCurseForgeInfo = useCallback(async () => {
    const response = await ResourceService.fetchRemoteResourceByLocal(
      OtherResourceSource.CurseForge,
      mod.filePath
    );
    if (response.status === "success") {
      const modId = response.data.resourceId;
      const res = await ResourceService.fetchRemoteResourceById(
        OtherResourceSource.CurseForge,
        modId
      );
      if (res.status === "success") {
        if (res.data.websiteUrl) {
          setCfModWebsiteUrl(res.data.websiteUrl);
        }
        if (res.data.mcmodId) {
          setMCModWebsiteUrl(
            `https://www.mcmod.cn/class/${res.data.mcmodId}.html`
          );
        }
      }
    }
  }, [mod.filePath]);

  const handleModrinthInfo = useCallback(async () => {
    const response = await ResourceService.fetchRemoteResourceByLocal(
      OtherResourceSource.Modrinth,
      mod.filePath
    );
    if (response.status === "success") {
      const modId = response.data.resourceId;
      const res = await ResourceService.fetchRemoteResourceById(
        OtherResourceSource.Modrinth,
        modId
      );
      if (res.status === "success") {
        if (res.data.websiteUrl) {
          setMrModWebsiteUrl(res.data.websiteUrl);
        }
        if (res.data.mcmodId) {
          setMCModWebsiteUrl(
            `https://www.mcmod.cn/class/${res.data.mcmodId}.html`
          );
        }
      }
    }
  }, [mod.filePath]);

  useEffect(() => {
    setCfModWebsiteUrl("");
    setMrModWebsiteUrl("");
    setMCModWebsiteUrl("");
    handleCurseForgeInfo();
    handleModrinthInfo();
  }, [handleCurseForgeInfo, handleModrinthInfo]);

  return (
    <Modal size={{ base: "md", lg: "lg", xl: "xl" }} {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalCloseButton />
        <ModalBody mt={2}>
          <OptionItem
            title={
              <Text fontWeight="semibold" fontSize="md" wordBreak="break-all">
                {showZhTrans && mod.translatedName
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
              <Text fontSize="xs-sm" mt="4px" className="secondary-text">
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
            marginRight={1.5}
          />
          <Text mt={4}>
            {(showZhTrans && mod.translatedDescription) || mod.description}
          </Text>
        </ModalBody>

        <ModalFooter w="100%">
          <HStack spacing={3}>
            <HStack spacing={2}>
              <LuExternalLink />
              <Button
                colorScheme={primaryColor}
                onClick={() => {
                  openUrl(cfModWebsiteUrl);
                }}
                fontSize="sm"
                variant="link"
                disabled={!cfModWebsiteUrl}
              >
                CurseForge
              </Button>
            </HStack>
            <HStack spacing={2}>
              <LuExternalLink />
              <Button
                colorScheme={primaryColor}
                onClick={() => {
                  openUrl(mrModWebsiteUrl);
                }}
                fontSize="sm"
                variant="link"
                disabled={!mrModWebsiteUrl}
              >
                Modrinth
              </Button>
            </HStack>
            <HStack spacing={2}>
              <LuExternalLink />
              <Button
                colorScheme={primaryColor}
                onClick={() => {
                  openUrl(MCModWebsiteUrl);
                }}
                fontSize="sm"
                variant="link"
                disabled={!MCModWebsiteUrl}
              >
                MCMod
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

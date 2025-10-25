import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Radio,
  RadioGroup,
  Text,
  VStack,
} from "@chakra-ui/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { error } from "@tauri-apps/plugin-log";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFolderOpen } from "react-icons/lu";
import { AutoSizer } from "react-virtualized";
import SegmentedControl from "@/components/common/segmented";
import SkinPreview from "@/components/skin-preview";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useToast } from "@/contexts/toast";
import { PresetRole, SkinModel, TextureType } from "@/enums/account";
import { Texture } from "@/models/account";
import { AccountService } from "@/services/account";
import { base64ImgSrc } from "@/utils/string";

type SkinType = PresetRole | "default" | "upload";

interface ManageSkinModalProps extends Omit<ModalProps, "children"> {
  playerId: string;
  skin?: Texture;
  cape?: Texture;
}

const ManageSkinModal: React.FC<ManageSkinModalProps> = ({
  playerId,
  isOpen,
  onClose,
  skin,
  cape,
  ...modalProps
}) => {
  const [selectedSkin, setSelectedSkin] = useState<SkinType>("default");
  const [uploadSkinFilePath, setUploadSkinFilePath] = useState<string>("");
  const [uploadCapeFilePath, setUploadCapeFilePath] = useState<string>("");
  const [skinModel, setSkinModel] = useState<SkinModel>(SkinModel.Default);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const { getPlayerList } = useGlobalData();
  const toast = useToast();
  const primaryColor = config.appearance.theme.primaryColor;

  const skinOptions = {
    default: {
      src: base64ImgSrc(skin?.image || ""),
      model: skin?.model || SkinModel.Default,
    },
    steve: { src: "/images/skins/steve.png", model: SkinModel.Default },
    alex: { src: "/images/skins/alex.png", model: SkinModel.Slim },
    upload: {
      src: uploadSkinFilePath
        ? convertFileSrc(uploadSkinFilePath)
        : "/images/skins/dummy.png",
      model: skinModel,
    },
  };

  useEffect(() => {
    setSelectedSkin(skin?.preset || "default");
  }, [skin]);

  useEffect(() => {
    if (!isOpen && selectedSkin === "upload") {
      setSelectedSkin(skin?.preset || "default");
      setUploadSkinFilePath("");
      setUploadCapeFilePath("");
      setSkinModel(SkinModel.Default);
    }
  }, [isOpen, selectedSkin, skin?.preset]);

  const handleSave = async () => {
    if (selectedSkin === "default") {
      return;
    }
    if (selectedSkin !== "upload") {
      setIsLoading(true);
      try {
        const resp = await AccountService.updatePlayerSkinOfflinePreset(
          playerId,
          selectedSkin
        );
        if (resp.status === "success") {
          toast({
            title: resp.message,
            status: "success",
          });
          getPlayerList(true);
          onClose();
        } else {
          toast({
            title: resp.message,
            description: resp.details,
            status: "error",
          });
        }
      } finally {
        setIsLoading(false);
      }
    } else if (uploadSkinFilePath) {
      setIsLoading(true);
      try {
        const skinResp = await AccountService.updatePlayerSkinOfflineLocal(
          playerId,
          uploadSkinFilePath,
          TextureType.Skin,
          skinModel
        );
        if (skinResp.status === "success") {
          if (uploadCapeFilePath) {
            const capeResp = await AccountService.updatePlayerSkinOfflineLocal(
              playerId,
              uploadCapeFilePath,
              TextureType.Cape,
              SkinModel.Default
            );
            if (capeResp.status !== "success") {
              toast({
                title: capeResp.message,
                description: capeResp.details,
                status: "error",
              });
              throw new Error("Cape upload failed");
            }
          }
          toast({
            title: skinResp.message,
            status: "success",
          });
        } else {
          toast({
            title: skinResp.message,
            description: skinResp.details,
            status: "error",
          });
        }
      } catch (e: any) {
        console.log(e);
        error(e.message);
      } finally {
        setIsLoading(false);
        getPlayerList(true);
        onClose();
      }
    }
  };

  const handleUploadSkinFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: t("General.dialog.filterName.image"),
          extensions: ["png"],
        },
      ],
    });
    if (selected) {
      setUploadSkinFilePath(selected);
    }
  };

  const handleUploadCapeFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: t("General.dialog.filterName.image"),
          extensions: ["png"],
        },
      ],
    });
    if (selected) {
      setUploadCapeFilePath(selected);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={
        selectedSkin === "upload"
          ? { base: "2xl", lg: "3xl", xl: "4xl" }
          : { base: "md", lg: "lg", xl: "xl" }
      }
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent width="100%">
        <ModalHeader>{t("ManageSkinModal.skinManage")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody width="100%">
          <Grid templateColumns="3fr 2fr" gap={4} h="320px" width="100%">
            <Box width="100%" height="100%">
              <AutoSizer>
                {({ height, width }) => (
                  <SkinPreview
                    skinSrc={skinOptions[selectedSkin].src}
                    skinModel={skinOptions[selectedSkin].model}
                    capeSrc={
                      selectedSkin === "default" && cape
                        ? base64ImgSrc(cape.image)
                        : selectedSkin === "upload" && uploadCapeFilePath
                          ? convertFileSrc(uploadCapeFilePath)
                          : undefined
                    }
                    width={width}
                    height={height}
                    showControlBar
                  />
                )}
              </AutoSizer>
            </Box>

            <VStack spacing={2} alignItems="flex-start" minWidth="100%">
              <RadioGroup
                value={selectedSkin}
                onChange={(skinType: SkinType) => setSelectedSkin(skinType)}
              >
                <VStack spacing={2} alignItems="flex-start">
                  {Object.keys(skinOptions).map((key) => (
                    <Radio key={key} value={key} colorScheme={primaryColor}>
                      <Text fontSize="sm">{t(`ManageSkinModal.${key}`)}</Text>
                    </Radio>
                  ))}
                </VStack>
              </RadioGroup>
              {selectedSkin === "upload" && (
                <VStack spacing={2} alignItems="flex-start" width="100%">
                  <FormControl display="flex" gap={2} alignItems="center">
                    <FormLabel htmlFor="model" mb={0}>
                      {t("ManageSkinModal.model.label")}
                    </FormLabel>
                    <SegmentedControl
                      id="model"
                      size="sm"
                      selected={skinModel}
                      onSelectItem={(value) => setSkinModel(value as SkinModel)}
                      items={[
                        {
                          label: t("ManageSkinModal.model.default"),
                          value: SkinModel.Default,
                        },
                        {
                          label: t("ManageSkinModal.model.slim"),
                          value: SkinModel.Slim,
                        },
                      ]}
                    />
                  </FormControl>
                  <FormControl display="flex" gap={2} alignItems="center">
                    <FormLabel htmlFor="skin" mb={0} minWidth="max-content">
                      {t("ManageSkinModal.skin")}
                    </FormLabel>
                    <HStack id="skin" spacing={2} width="100%">
                      <Input
                        value={uploadSkinFilePath}
                        onChange={(e) => setUploadSkinFilePath(e.target.value)}
                        flex={1}
                        variant="filled"
                      />
                      <IconButton
                        onClick={handleUploadSkinFile}
                        variant="ghost"
                        width="100%"
                        aria-label={t("ManageSkinModal.upload")}
                        flex={0}
                      >
                        <LuFolderOpen />
                      </IconButton>
                    </HStack>
                  </FormControl>
                  <FormControl display="flex" gap={2} alignItems="center">
                    <FormLabel htmlFor="cape" mb={0} minWidth="max-content">
                      {t("ManageSkinModal.cape")}
                    </FormLabel>
                    <HStack id="cape" spacing={2} width="100%">
                      <Input
                        value={uploadCapeFilePath}
                        onChange={(e) => setUploadCapeFilePath(e.target.value)}
                        flex={1}
                        variant="filled"
                      />
                      <IconButton
                        onClick={handleUploadCapeFile}
                        variant="ghost"
                        width="100%"
                        aria-label={t("ManageSkinModal.upload")}
                        flex={0}
                      >
                        <LuFolderOpen />
                      </IconButton>
                    </HStack>
                  </FormControl>
                </VStack>
              )}
            </VStack>
          </Grid>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            variant="solid"
            colorScheme={primaryColor}
            onClick={handleSave}
            isLoading={isLoading}
            disabled={
              selectedSkin === "default" ||
              (selectedSkin === "upload" && !uploadSkinFilePath) ||
              skin?.preset === selectedSkin
            }
          >
            {t("General.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ManageSkinModal;

import {
  Button,
  Flex,
  Grid,
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
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SkinPreview from "@/components/skin-preview";
import { useLauncherConfig } from "@/contexts/config";
import { useData } from "@/contexts/data";
import { useToast } from "@/contexts/toast";
import { Texture } from "@/models/account";
import { AccountService } from "@/services/account";
import { base64ImgSrc } from "@/utils/string";

type SkinType = "default" | "steve" | "alex";

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const { getPlayerList } = useData();
  const toast = useToast();
  const primaryColor = config.appearance.theme.primaryColor;

  const skinOptions = {
    default: base64ImgSrc(skin?.image || ""),
    steve: "/images/skins/steve.png",
    alex: "/images/skins/alex.png",
  };

  useEffect(() => {
    setSelectedSkin("default");
  }, [skin]);
  const handleSave = () => {
    if (selectedSkin !== "default") {
      setIsLoading(true);
      AccountService.updatePlayerSkinOfflinePreset(playerId, selectedSkin)
        .then((response) => {
          if (response.status === "success") {
            toast({
              title: response.message,
              status: "success",
            });
            getPlayerList(true);
            onClose();
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "md", lg: "lg", xl: "xl" }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("ManageSkinModal.skinManage")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Grid templateColumns="3fr 2fr" gap={4} h="320px">
            <Flex justify="center" align="center" width="100%" height="100%">
              <SkinPreview
                skinSrc={skinOptions[selectedSkin]}
                capeSrc={
                  selectedSkin === "default" && cape
                    ? base64ImgSrc(cape.image)
                    : undefined
                }
                width={270}
                height={310}
                showControlBar
              />
            </Flex>

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
          >
            {t("General.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ManageSkinModal;

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
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SkinPreview from "@/components/common/skin-preview";
import { useLauncherConfig } from "@/contexts/config";

export type SkinType = "default" | "steve" | "alex";

interface ManageSkinModalProps extends Omit<ModalProps, "children"> {
  skin?: SkinType;
  isCenter?: boolean;
  onSelectSkin?: (skin: SkinType) => void;
}

const ManageSkinModal: React.FC<ManageSkinModalProps> = ({
  isOpen,
  onClose,
  isCenter = false,
  skin = "default",
  onSelectSkin,
  ...modalProps
}) => {
  const [selectedSkin, setSelectedSkin] = useState<SkinType>(skin);
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const skinOptions = {
    default: "/images/skins/unicorn_isla.png",
    steve: "/images/skins/steve.png",
    alex: "/images/skins/alex.png",
  };

  useEffect(() => {
    setSelectedSkin(skin);
  }, [skin]);

  const handleSave = () => {
    if (onSelectSkin) {
      onSelectSkin(selectedSkin);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered={isCenter}
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
                width={270}
                height={310}
                showControlBar
              />
            </Flex>

            <RadioGroup
              value={selectedSkin}
              onChange={(skinType: SkinType) => setSelectedSkin(skinType)}
            >
              <VStack spacing={4} alignItems="flex-start">
                {Object.keys(skinOptions).map((key) => (
                  <Radio key={key} value={key} colorScheme={primaryColor}>
                    {t(`ManageSkinModal.${key}`)}
                  </Radio>
                ))}
              </VStack>
            </RadioGroup>
          </Grid>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("ManageSkinModal.cancel")}
          </Button>
          <Button
            variant="solid"
            colorScheme={primaryColor}
            onClick={handleSave}
            ml={3}
          >
            {t("ManageSkinModal.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ManageSkinModal;

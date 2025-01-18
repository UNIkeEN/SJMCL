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

interface ManageSkinModalProps extends Omit<ModalProps, "children"> {
  initialSkin?: "default" | "steve" | "alex";
  isCenter?: boolean;
  onOKCallback?: () => void;
}

const skinOptions = {
  default: "/images/skins/unicorn_isla.png",
  steve: "/images/skins/steve.png",
  alex: "/images/skins/alex.png",
} as const;

type SkinType = keyof typeof skinOptions;

const ManageSkinModal: React.FC<ManageSkinModalProps> = ({
  isOpen,
  onClose,
  isCenter = false,
  initialSkin = "default",
  onOKCallback,
  ...modalProps
}) => {
  const [skin, setSkin] = useState<SkinType>(initialSkin);
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  useEffect(() => {
    setSkin(initialSkin);
  }, [initialSkin]);

  const handleSkinChange = (skinType: SkinType) => {
    setSkin(skinType);
  };

  const handleSave = () => {
    if (onOKCallback) {
      onOKCallback();
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
                skinSrc={skinOptions[skin]}
                width={270}
                height={310}
                showControlBar
              />
            </Flex>

            <RadioGroup value={skin} onChange={handleSkinChange}>
              <VStack spacing={4}>
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
          <Flex width="100%" justify="flex-end" alignItems="center">
            <Button variant="ghost" onClick={onClose} ml={2}>
              {t("ManageSkinModal.cancel")}
            </Button>
            <Button
              variant="solid"
              colorScheme={primaryColor}
              onClick={handleSave}
              ml={2}
            >
              {t("ManageSkinModal.confirm")}
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ManageSkinModal;

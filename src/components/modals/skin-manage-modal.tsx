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
  Radio,
  RadioGroup,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import SkinPreview from "@/components/common/skin-preview";
import { useToast } from "@/contexts/toast";

interface SkinManageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const skinOptions = {
  default: "/images/skins/unicorn_isla.png",
  steve: "/images/skins/steve.png",
  alex: "/images/skins/alex.png",
} as const;

type SkinType = keyof typeof skinOptions;

const SkinManageModal: React.FC<SkinManageModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [skin, setSkin] = useState<SkinType>("default");
  const { t } = useTranslation();
  const toast = useToast();

  const handleSkinChange = (skinType: SkinType) => {
    setSkin(skinType);
  };

  const handleSave = () => {
    console.log(skinOptions[skin]);
    toast({
      title: t("SkinManageModal.success"),
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("SkinManageModal.skinManage")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Grid templateColumns="3fr 2fr" gap={4} h="320px">
            <Flex justify="center" align="center" width="100%" height="100%">
              <SkinPreview
                skinSrc={skinOptions[skin]}
                width={270}
                height={310}
                showControlBar={true}
              />
            </Flex>

            <VStack
              spacing={8}
              align="flex-start"
              mt={4}
              height="100%"
              justify="flex-start"
              width="180"
            >
              <RadioGroup value={skin} onChange={handleSkinChange}>
                {Object.keys(skinOptions).map((key) => (
                  <Radio
                    key={key}
                    value={key}
                    border="1px solid"
                    borderColor="black"
                    _active={{ bg: "blue" }}
                    width="100%"
                    mb={2}
                  >
                    {t(`SkinManageModal.${key}`)}
                  </Radio>
                ))}
              </RadioGroup>
            </VStack>
          </Grid>
        </ModalBody>

        <ModalFooter>
          <Flex width="100%" justify="flex-end" alignItems="center">
            <Button
              variant="solid"
              colorScheme="blue"
              onClick={handleSave}
              ml={2}
            >
              {t("SkinManageModal.confirm")}
            </Button>
            <Button variant="ghost" onClick={onClose} ml={2}>
              {t("SkinManageModal.cancel")}
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SkinManageModal;

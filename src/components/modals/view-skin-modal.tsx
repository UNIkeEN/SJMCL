import {
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import SkinPreview from "@/components/skin-preview";
import { Texture } from "@/models/account";
import { base64ImgSrc } from "@/utils/string";

interface ViewSkinModalProps extends Omit<ModalProps, "children"> {
  skin?: Texture;
  cape?: Texture;
}

const ViewSkinModal: React.FC<ViewSkinModalProps> = ({
  isOpen,
  onClose,
  skin,
  cape,
  ...modalProps
}) => {
  const [isCapeVisible, setIsCapeVisible] = useState<boolean>(true);
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("ViewSkinModal.skinView")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Flex justify="center" align="center" width="100%" height="100%">
            <SkinPreview
              skinSrc={skin && base64ImgSrc(skin.image)}
              capeSrc={cape && base64ImgSrc(cape.image)}
              width={416} // calculated from model content size
              height={310}
              showControlBar
              isCapeVisible={isCapeVisible}
              onCapeVisibilityChange={setIsCapeVisible}
            />
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default ViewSkinModal;

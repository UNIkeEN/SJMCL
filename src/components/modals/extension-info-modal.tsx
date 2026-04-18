import {
  Avatar,
  Box,
  Button,
  Divider,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  ModalProps,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { OptionItem } from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { ExtensionInfo } from "@/models/extension";
import { base64ImgSrc, formatByteSize } from "@/utils/string";

interface ExtensionInfoModalProps extends Omit<ModalProps, "children"> {
  extension: ExtensionInfo;
}

const ExtensionInfoModal: React.FC<ExtensionInfoModalProps> = ({
  extension,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const InfoField: React.FC<{ label: string; value: string }> = ({
    label,
    value,
  }) => (
    <Box>
      <Text fontSize="xs" className="secondary-text">
        {label}
      </Text>
      <Text mt={1} fontSize="sm" wordBreak="break-all">
        {value}
      </Text>
    </Box>
  );

  return (
    <Modal size={{ base: "md", lg: "lg", xl: "xl" }} {...modalProps}>
      <ModalOverlay />
      <ModalContent>
        <ModalCloseButton />
        <ModalBody mt={2}>
          <OptionItem
            title={
              <Text fontWeight="semibold" fontSize="md" wordBreak="break-all">
                {extension.name}
              </Text>
            }
            titleExtra={
              <HStack>
                {extension.version ? (
                  <Text className="secondary-text">{extension.version}</Text>
                ) : undefined}
              </HStack>
            }
            description={
              <Text fontSize="xs-sm" mt="4px" className="secondary-text">
                {extension.identifier}
              </Text>
            }
            prefixElement={
              <Avatar
                src={base64ImgSrc(extension.iconSrc)}
                name={extension.name}
                boxSize="40px"
                borderRadius="4px"
              />
            }
            marginRight={1.5}
          />
          <Divider my={4} />
          <VStack spacing={3} align="stretch">
            {extension.description && (
              <InfoField
                label={t("ExtensionInfoModal.label.description")}
                value={extension.description}
              />
            )}
            {extension.author && (
              <InfoField
                label={t("ExtensionInfoModal.label.author")}
                value={extension.author}
              />
            )}
            {extension.folderSize !== undefined && (
              <InfoField
                label={t("ExtensionInfoModal.label.size")}
                value={formatByteSize(extension.folderSize)}
              />
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme={primaryColor} onClick={modalProps.onClose}>
            {t("General.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ExtensionInfoModal;

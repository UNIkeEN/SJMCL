import {
  Flex,
  HStack,
  Icon,
  IconButton,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  ModalProps,
  Text,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import React from "react";
import { LuCalendarDays, LuFolderOpen } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";
import { Screenshot } from "@/models/game-instance";
import { ISOToDatetime } from "@/utils/datetime";

interface ScreenshotPreviewModalProps extends Omit<ModalProps, "children"> {
  screenshot: Screenshot;
}

const ScreenshotPreviewModal: React.FC<ScreenshotPreviewModalProps> = ({
  screenshot,
  ...props
}) => {
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  return (
    <Modal {...props}>
      <ModalOverlay />
      <ModalContent>
        <ModalCloseButton />
        <ModalBody pt={0} pl={0} pr={0} pb={2}>
          <Image
            src={screenshot.imgSrc}
            alt={screenshot.fileName}
            borderRadius="lg"
            minWidth="100%"
            maxHeight="300px"
            objectFit="cover"
          />
          <Flex justify="space-between" align="center" mt={2} px={4}>
            <Text fontSize="sm" color="gray.500">
              {screenshot.fileName}
            </Text>

            <HStack spacing={2}>
              <Icon as={LuCalendarDays} color="gray.500" />
              <Text fontSize="sm" color="gray.500">
                {ISOToDatetime(screenshot.time)}
              </Text>
              <IconButton
                icon={<LuFolderOpen />}
                aria-label="Open Folder"
                colorScheme={primaryColor}
                size="xs"
                onClick={() => {
                  open(screenshot.filePath);
                }}
              />
            </HStack>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default ScreenshotPreviewModal;

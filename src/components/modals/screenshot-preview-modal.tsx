import {
  Flex,
  HStack,
  Icon,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  ModalProps,
  Text,
} from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import React from "react";
import { LuCalendarDays } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { Screenshot } from "@/models/game-instance";
import { ISOToDatetime } from "@/utils/datetime";

interface ScreenshotPreviewModalProps extends Omit<ModalProps, "children"> {
  screenshot: Screenshot;
}

const ScreenshotPreviewModal: React.FC<ScreenshotPreviewModalProps> = ({
  screenshot,
  ...props
}) => {
  return (
    <Modal {...props}>
      <ModalOverlay />
      <ModalContent>
        <Image
          src={screenshot.imgSrc}
          alt={screenshot.fileName}
          borderRadius="md"
          objectFit="cover"
        />
        <ModalCloseButton />
        <ModalBody>
          <Flex justify="space-between" align="center" mt={-1}>
            <Text fontSize="sm" fontWeight="bold">
              {screenshot.fileName}
            </Text>
            <HStack spacing={2}>
              <Icon as={LuCalendarDays} color="gray.500" />
              <Text fontSize="xs" className="secondary-text">
                {ISOToDatetime(screenshot.time)}
              </Text>
              <CommonIconButton
                icon="revealFile"
                tooltipPlacement="top"
                variant="ghost"
                onClick={() => {
                  revealItemInDir(screenshot.filePath);
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

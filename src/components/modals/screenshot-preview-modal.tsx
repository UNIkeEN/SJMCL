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
import { Screenshot } from "@/models/game-instance";
import { ISOToDatetime } from "@/utils/datetime";
import { CommonIconButton } from "../common/common-icon-button";

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
        <ModalCloseButton />
        <ModalBody pt={0} pl={0} pr={0} pb={2}>
          <Image
            src={screenshot.imgSrc}
            alt={screenshot.fileName}
            borderRadius="md"
            objectFit="cover"
          />
          <Flex justify="space-between" align="center" mt={2} px={4}>
            <Text fontSize="sm" fontWeight="bold" color="black">
              {screenshot.fileName}
            </Text>

            <HStack spacing={2}>
              <Icon as={LuCalendarDays} color="gray.500" />
              <Text fontSize="xs" fontWeight="bold" color="gray.500">
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

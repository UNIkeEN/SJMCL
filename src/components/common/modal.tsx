import {
  Modal as ChakraModal,
  type ModalProps as ChakraModalProps,
} from "@chakra-ui/react";
import React from "react";

/**
 * Global Modal wrapper that defaults returnFocusOnClose to false.
 * Use this instead of importing Modal directly from @chakra-ui/react.
 */
export const Modal: React.FC<ChakraModalProps> = (props) => (
  <ChakraModal returnFocusOnClose={false} {...props} />
);

export type ModalProps = ChakraModalProps;

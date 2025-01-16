import { useBreakpointValue } from "@chakra-ui/react";
import React, { createContext, useContext } from "react";

type ModalSize = "md" | "lg" | "xl";

const ModalPropsContext = createContext<ModalSize>("md");

export const ModalPropsProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const modalSize =
    useBreakpointValue<ModalSize>({
      base: "md",
      md: "lg",
      lg: "xl",
    }) ?? "md";

  return (
    <ModalPropsContext.Provider value={modalSize}>
      {children}
    </ModalPropsContext.Provider>
  );
};

export const useModalProps = (): ModalSize => useContext(ModalPropsContext);

import {
  ModalHeader as ChakraModalHeader,
  ModalHeaderProps as ChakraModalHeaderProps,
} from "@chakra-ui/react";
import { useLauncherConfig } from "@/contexts/config";

export const MacosModalHeader: React.FC<ChakraModalHeaderProps> = (props) => {
  const { config } = useLauncherConfig();
  const isMac =
    config.basicInfo.osType === "macos" || config.basicInfo.osType === "darwin";

  return <ChakraModalHeader textAlign={isMac ? "center" : "left"} {...props} />;
};

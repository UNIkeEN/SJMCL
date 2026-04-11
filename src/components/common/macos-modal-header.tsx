import {
  ModalHeader as ChakraModalHeader,
  ModalHeaderProps as ChakraModalHeaderProps,
} from "@chakra-ui/react";
import { useLauncherConfig } from "@/contexts/config";
import { isMacPlatform } from "@/utils/platform";

export const MacosModalHeader: React.FC<ChakraModalHeaderProps> = (props) => {
  const { config } = useLauncherConfig();
  const isMac = isMacPlatform(config.basicInfo.osType);

  return <ChakraModalHeader textAlign={isMac ? "center" : "left"} {...props} />;
};

import { Flex, Text } from "@chakra-ui/react";
import { useRef } from "react";
import { TitleShort } from "@/components/logo-title";
import { useLauncherConfig } from "@/contexts/config";

// easy-launcher home (docs/design/DESIGN-homebar.md): the page is just the live
// stage — the background shows through, the brand sits top-left and the
// homebar carries all navigation.
const LaunchPage = () => {
  const layoutRef = useRef<HTMLDivElement>(null);
  const { config } = useLauncherConfig();

  return (
    <Flex ref={layoutRef} h="100%" w="100%">
      <Flex position="absolute" top={6} left={8} direction="column">
        <TitleShort aria-label="easy-launcher" />
        <Text fontSize="xs" color="muted" mt={1}>
          {config.basicInfo.launcherVersion}
        </Text>
      </Flex>
    </Flex>
  );
};

export default LaunchPage;

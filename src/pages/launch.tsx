import { Box, Flex } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import HomeWidgetContainer from "@/components/extension/home-widget-container";

// easy-launcher home (docs/design/DESIGN-homebar.md): the page is just the live
// stage — the background shows through and the homebar carries all navigation.
const LaunchPage = () => {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [maxWidgetWidth, setMaxWidgetWidth] = useState<number>(320);

  useEffect(() => {
    const layoutEl = layoutRef.current;
    if (!layoutEl) return;

    const updateMaxWidgetWidth = () => {
      const available = Math.min(320, layoutEl.clientWidth * 0.35);
      setMaxWidgetWidth(Math.max(240, Math.floor(available)));
    };

    updateMaxWidgetWidth();
    const observer = new ResizeObserver(updateMaxWidgetWidth);
    observer.observe(layoutEl);
    return () => observer.disconnect();
  }, []);

  return (
    <Flex ref={layoutRef} h="100%" w="100%">
      <Box
        position="absolute"
        top={4}
        right={4}
        maxH={{ base: "55%", lg: "calc(100% - 96px)" }}
        overflow="hidden"
      >
        <HomeWidgetContainer maxWidth={maxWidgetWidth} />
      </Box>
    </Flex>
  );
};

export default LaunchPage;

import { Flex } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import HomeWidgetContainer from "@/components/extension/home-widget-container";
import LaunchHome from "@/components/launch-home";

const LaunchPage = () => {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [maxWidgetWidth, setMaxWidgetWidth] = useState<number>(320);

  useEffect(() => {
    const layoutEl = layoutRef.current;
    if (!layoutEl) return;

    const updateMaxWidgetWidth = () => {
      // keep a margin for the stats card overlay on the stage panel
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
      <LaunchHome
        widgetSlot={<HomeWidgetContainer maxWidth={maxWidgetWidth} />}
      />
    </Flex>
  );
};

export default LaunchPage;

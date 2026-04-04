import { Box, Text, VStack } from "@chakra-ui/react";
import { type MouseEvent as ReactMouseEvent, useEffect, useState } from "react";
import AdvancedCard from "@/components/common/advanced-card";

interface HomeWidgetContainerProps {
  maxWidth: number;
}

const HomeWidgetContainer = ({ maxWidth }: HomeWidgetContainerProps) => {
  const [cardWidth, setCardWidth] = useState(420);
  const safeWidth = Math.min(cardWidth, maxWidth);

  useEffect(() => {
    setCardWidth((prev) => Math.min(prev, maxWidth));
  }, [maxWidth]);

  const handleResizeStart = (event: ReactMouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = cardWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const width = startWidth + (moveEvent.clientX - startX);
      const nextWidth = Math.max(0, Math.min(width, maxWidth));
      setCardWidth(nextWidth);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <Box
      flexShrink={0}
      w={`${safeWidth}px`}
      minW={0}
      minH={0}
      h="100%"
      maxH="100%"
      overflow="hidden"
      position="relative"
    >
      <Box
        position="absolute"
        inset={0}
        overflowY="auto"
        overflowX="hidden"
        className="no-scrollbar"
      >
        <VStack align="stretch" spacing={4}>
          <AdvancedCard level="back" p={4} minH="6.5rem" w="100%">
            <Text fontWeight="bold">Gold Price</Text>
            <Text fontSize="xs" className="secondary-text">
              org.sjmcl.gold_price
            </Text>
          </AdvancedCard>

          <AdvancedCard level="back" p={4} minH="8.5rem" w="100%">
            <Text fontWeight="bold">SMP2 Parkour</Text>
            <Text fontSize="xs" className="secondary-text">
              org.sjmcl.smp2_parkour
            </Text>
          </AdvancedCard>

          <AdvancedCard level="back" p={4} minH="7.5rem" w="100%">
            <Text fontWeight="bold">Launch Snapshot</Text>
            <Text fontSize="xs" className="secondary-text">
              org.sjmcl.launch_snapshot
            </Text>
          </AdvancedCard>

          <AdvancedCard level="back" p={4} minH="9rem" w="100%">
            <Text fontWeight="bold">Quick Notes</Text>
            <Text fontSize="xs" className="secondary-text">
              org.sjmcl.quick_notes
            </Text>
          </AdvancedCard>
        </VStack>
      </Box>

      <Box
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        w="10px"
        cursor="ew-resize"
        onMouseDown={handleResizeStart}
      />
    </Box>
  );
};

export default HomeWidgetContainer;

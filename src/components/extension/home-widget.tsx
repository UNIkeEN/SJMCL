import { Avatar, Box, HStack, Icon, IconButton, Text } from "@chakra-ui/react";
import { type MouseEvent as ReactMouseEvent, useState } from "react";
import { LuChevronRight } from "react-icons/lu";
import AdvancedCard from "@/components/common/advanced-card";
import ExtensionContributionWrapper from "@/components/extension/contribution-wrapper";
import { ExtensionHomeWidgetContribution } from "@/models/extension";
import { clamp } from "@/utils/math";
import { base64ImgSrc } from "@/utils/string";

interface HomeWidgetProps {
  widget: ExtensionHomeWidgetContribution;
  // widget width state and bound are managed and calculated by the container.
  width: number;
  widthBounds: {
    lower: number;
    upper: number;
  };
  onWidthChange: (width: number) => void;
}

const HomeWidget = ({
  widget,
  width,
  widthBounds,
  onWidthChange,
}: HomeWidgetProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const WidgetComponent = widget.Component;
  const iconSrc = widget.icon || base64ImgSrc(widget.extension.iconSrc);

  // drag to resize
  const handleResizeStart = (event: ReactMouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const next = startWidth + (moveEvent.clientX - startX);
      onWidthChange(clamp(next, widthBounds.lower, widthBounds.upper));
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
      position="relative"
      w={isCollapsed ? "max-content" : `${width}px`}
      minW={0}
      maxW="100%"
      alignSelf="start"
    >
      <AdvancedCard level="back" p={3} w="100%">
        <HStack align="center" mb={isCollapsed ? 0 : 2}>
          <IconButton
            aria-label={
              isCollapsed
                ? `expand ${widget.title} widget`
                : `collapse ${widget.title} widget`
            }
            aria-expanded={!isCollapsed}
            icon={
              <Icon
                as={LuChevronRight}
                boxSize={3.5}
                sx={{
                  transition: "transform 0.2s ease-in-out",
                  transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                }}
              />
            }
            size="xs"
            h={21}
            variant="ghost"
            colorScheme="gray"
            onClick={() => setIsCollapsed((prev) => !prev)}
          />
          <Avatar
            src={iconSrc}
            name={widget.title}
            boxSize="20px"
            borderRadius="md"
            size="xs"
          />
          <Text fontSize="xs-sm" fontWeight="semibold" noOfLines={1}>
            {widget.title}
          </Text>
        </HStack>

        <Box display={isCollapsed ? "none" : "block"} w="100%">
          <ExtensionContributionWrapper resetKey={widget.resetKey}>
            <WidgetComponent />
          </ExtensionContributionWrapper>
        </Box>
      </AdvancedCard>

      {/* resize area */}
      {!isCollapsed && (
        <Box
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          w="10px"
          cursor="ew-resize"
          onMouseDown={handleResizeStart}
        />
      )}
    </Box>
  );
};

export default HomeWidget;

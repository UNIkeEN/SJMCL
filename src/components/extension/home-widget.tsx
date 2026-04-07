import { Box, Image, Text } from "@chakra-ui/react";
import { type MouseEvent as ReactMouseEvent } from "react";
import AdvancedCard from "@/components/common/advanced-card";
import { OptionItem } from "@/components/common/option-item";
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
      w={`${width}px`}
      minW={0}
      maxW="100%"
      alignSelf="start"
    >
      <AdvancedCard level="back" p={3} w="100%">
        <OptionItem
          prefixElement={
            <Image
              src={iconSrc}
              alt={widget.title}
              boxSize="20px"
              borderRadius="md"
              objectFit="cover"
            />
          }
          title={
            <Text fontSize="xs-sm" fontWeight="semibold">
              {widget.title}
            </Text>
          }
          mb={2}
        />

        <ExtensionContributionWrapper resetKey={widget.resetKey}>
          <WidgetComponent />
        </ExtensionContributionWrapper>
      </AdvancedCard>

      {/* resize area */}
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

export default HomeWidget;

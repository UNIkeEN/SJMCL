import {
  Avatar,
  Box,
  HStack,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Text,
} from "@chakra-ui/react";
import { type MouseEvent as ReactMouseEvent, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronRight, LuTriangle } from "react-icons/lu";
import AdvancedCard from "@/components/common/advanced-card";
import { CommonIconButton } from "@/components/common/common-icon-button";
import ExtensionContributionWrapper from "@/components/extension/contribution-wrapper";
import { ExtensionHomeWidgetContribution } from "@/models/extension";
import { clamp } from "@/utils/math";
import { base64ImgSrc } from "@/utils/string";

interface HomeWidgetProps {
  widget: ExtensionHomeWidgetContribution;
  // widget width state and bounds, as well as collapsed state, are managed and calculated by the container.
  width: number;
  widthBounds: {
    lower: number;
    upper: number;
  };
  onWidthChange: (width: number) => void;
  onWidthCommit: (width: number) => void;
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  showMoveUpButton: boolean;
  onMoveUp: () => void;
}

interface ExtraOperationMenuProps {
  isCollapsed: boolean;
  onMoveUp: () => void;
}

const ExtraOperationMenu = ({
  isCollapsed,
  onMoveUp,
}: ExtraOperationMenuProps) => {
  const { t } = useTranslation();

  const extraOpMenu = {
    moveUp: {
      icon: LuTriangle,
      onClick: onMoveUp,
    },
  };

  return (
    <Menu>
      <MenuButton
        as={CommonIconButton}
        icon="more"
        withTooltip={false}
        size="xs"
        h={21}
        ml={isCollapsed ? 0 : "auto"}
      />
      <Portal>
        <MenuList>
          {Object.entries(extraOpMenu).map(([key, item]) => (
            <MenuItem key={key} fontSize="xs" onClick={item.onClick}>
              <HStack>
                <item.icon />
                <Text>{t(`HomeWidget.extraOpMenu.${key}`)}</Text>
              </HStack>
            </MenuItem>
          ))}
        </MenuList>
      </Portal>
    </Menu>
  );
};

const HomeWidget = ({
  widget,
  width,
  widthBounds,
  onWidthChange,
  onWidthCommit,
  isCollapsed,
  onCollapsedChange,
  showMoveUpButton,
  onMoveUp,
}: HomeWidgetProps) => {
  const resizeHandlersRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const cleanup = resizeHandlersRef.current;
    return () => {
      cleanup?.();
    };
  }, []);
  const WidgetComponent = widget.Component;
  const iconSrc = widget.icon || base64ImgSrc(widget.extension.iconSrc);

  // drag to resize
  const handleResizeStart = (event: ReactMouseEvent) => {
    event.preventDefault();
    resizeHandlersRef.current?.();

    const startX = event.clientX;
    const startWidth = width;

    const cleanup = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      resizeHandlersRef.current = null;
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const next = startWidth + (moveEvent.clientX - startX);
      onWidthChange(clamp(next, widthBounds.lower, widthBounds.upper));
    };
    const handleMouseUp = (moveEvent: MouseEvent) => {
      const next = startWidth + (moveEvent.clientX - startX);
      onWidthCommit(clamp(next, widthBounds.lower, widthBounds.upper));
      cleanup();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    resizeHandlersRef.current = cleanup;
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
            onClick={() => onCollapsedChange(!isCollapsed)}
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
          {showMoveUpButton && (
            <ExtraOperationMenu isCollapsed={isCollapsed} onMoveUp={onMoveUp} />
          )}
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

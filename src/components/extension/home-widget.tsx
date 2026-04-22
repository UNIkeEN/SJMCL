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
import { useRouter } from "next/router";
import { type MouseEvent as ReactMouseEvent, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronRight,
  LuInfo,
  LuSettings,
} from "react-icons/lu";
import AdvancedCard from "@/components/common/advanced-card";
import { CommonIconButton } from "@/components/common/common-icon-button";
import ExtensionContributionWrapper from "@/components/extension/contribution-wrapper";
import { useExtensionHost } from "@/contexts/extension/host";
import { useSharedModals } from "@/contexts/shared-modal";
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
  canMoveUp: boolean;
  onMoveUp: () => void;
  canMoveDown: boolean;
  onMoveDown: () => void;
}

interface ExtraOperationMenuProps {
  widget: ExtensionHomeWidgetContribution;
  canMoveUp: boolean;
  onMoveUp: () => void;
  canMoveDown: boolean;
  onMoveDown: () => void;
}

const ExtraOperationMenu = ({
  widget,
  canMoveUp,
  onMoveUp,
  canMoveDown,
  onMoveDown,
}: ExtraOperationMenuProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { openSharedModal } = useSharedModals();
  const { getExtensionSettingsPage } = useExtensionHost();
  const hasSettingsPage = !!getExtensionSettingsPage(
    widget.extension.identifier
  );

  const extraOpMenu = [
    ...(canMoveUp
      ? [
          {
            key: "moveUp",
            icon: LuArrowUp,
            onClick: onMoveUp,
          },
        ]
      : []),
    ...(canMoveDown
      ? [
          {
            key: "moveDown",
            icon: LuArrowDown,
            onClick: onMoveDown,
          },
        ]
      : []),
    {
      key: "extensionInfo",
      icon: LuInfo,
      onClick: () => {
        openSharedModal("extension-info", { extension: widget.extension });
      },
    },
    ...(hasSettingsPage
      ? [
          {
            key: "settings",
            icon: LuSettings,
            onClick: () => {
              router.push(`/settings/extension/${widget.extension.identifier}`);
            },
          },
        ]
      : []),
  ];

  return (
    <Menu>
      <MenuButton
        as={CommonIconButton}
        icon="more"
        withTooltip={false}
        size="xs"
        h={21}
        ml="auto"
      />
      <Portal>
        <MenuList>
          {extraOpMenu.map((item) => (
            <MenuItem key={item.key} fontSize="xs" onClick={item.onClick}>
              <HStack>
                <item.icon />
                <Text>{t(`HomeWidget.extraOpMenu.${item.key}`)}</Text>
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
  canMoveUp,
  onMoveUp,
  canMoveDown,
  onMoveDown,
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
          <ExtraOperationMenu
            widget={widget}
            canMoveUp={canMoveUp}
            onMoveUp={onMoveUp}
            canMoveDown={canMoveDown}
            onMoveDown={onMoveDown}
          />
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
          zIndex={4} // fix issue under liquid-glass mode
          w="10px"
          cursor="ew-resize"
          onMouseDown={handleResizeStart}
        />
      )}
    </Box>
  );
};

export default HomeWidget;

import { Box, BoxProps, HStack, Text } from "@chakra-ui/react";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

// Hand-rolled dropdown primitives (docs/design/DESIGN-settings.md): Chakra's
// Menu/Popover paint invisibly in the Tauri WebKitGTK webview (portal +
// framer-motion layer). These render a plain viewport-fixed surface next to
// the trigger — no portal, no animation — which WebKitGTK always paints.

export const useDropdownPosition = (
  rootRef: React.RefObject<HTMLElement>,
  listRef: React.RefObject<HTMLElement>,
  open: boolean,
  placement: "top" | "bottom",
  align: "start" | "end"
) => {
  const [pos, setPos] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    w: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const h = listRef.current?.offsetHeight ?? 0;
    const w = Math.max(160, rect.width);
    const roomBelow = window.innerHeight - rect.bottom;
    const flip = placement === "top" || (roomBelow < h + 8 && rect.top > h + 8);
    const left = align === "end" ? rect.right - w : rect.left;
    setPos(
      flip
        ? { left, bottom: window.innerHeight - rect.top + 4, w }
        : { left, top: rect.bottom + 4, w }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placement, align]);

  return pos;
};

export interface DropdownSurfaceProps extends BoxProps {
  rootRef: React.RefObject<HTMLElement>;
  open: boolean;
  placement?: "top" | "bottom";
  align?: "start" | "end";
}

// The absolutely-positioned menu surface. Hidden for one frame while its
// height is measured, then placed at viewport coordinates.
export const DropdownSurface: React.FC<DropdownSurfaceProps> = ({
  rootRef,
  open,
  placement = "bottom",
  align = "start",
  ...boxProps
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPosition(rootRef, listRef, open, placement, align);

  if (!open) return null;

  return (
    <Box
      ref={listRef}
      role="listbox"
      position="fixed"
      zIndex={20}
      maxH="40vh"
      overflowY="auto"
      py={1}
      backgroundColor="#141414"
      border="1px solid"
      borderColor="line"
      borderRadius="el-md"
      boxShadow="0 8px 24px rgba(0,0,0,0.5)"
      style={{
        visibility: pos ? "visible" : "hidden",
        left: pos?.left,
        top: pos?.top,
        bottom: pos?.bottom,
        width: pos?.w,
      }}
      {...boxProps}
    />
  );
};

export interface DropdownMenuItem {
  label: React.ReactNode;
  icon?: React.ComponentType<{ size?: number }>;
  danger?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onClick: () => void;
}

interface DropdownMenuProps {
  trigger: (p: { onClick: () => void }) => React.ReactNode;
  items: DropdownMenuItem[];
  placement?: "top" | "bottom";
  align?: "start" | "end";
  listProps?: BoxProps;
  // controlled mode (e.g. submenu opened by another button)
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  placement = "bottom",
  align = "start",
  listProps,
  isOpen: isOpenProp,
  onOpen,
  onClose,
}) => {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = isOpenProp ?? innerOpen;
  const rootRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (isOpenProp != null) {
      open ? onClose?.() : onOpen?.();
    } else {
      setInnerOpen((o) => !o);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) toggle();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") toggle();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Box
      ref={rootRef}
      position="relative"
      display="inline-block"
      flexShrink={0}
      className="dropdown-menu"
    >
      {trigger({ onClick: toggle })}
      <DropdownSurface
        rootRef={rootRef}
        open={open}
        placement={placement}
        align={align}
        {...listProps}
      >
        {items.map((item, i) => (
          <HStack
            key={i}
            as="button"
            type="button"
            role="option"
            aria-selected={!!item.selected}
            w="100%"
            px={3}
            py={1.5}
            gap={2}
            cursor={item.disabled ? "not-allowed" : "pointer"}
            opacity={item.disabled ? 0.4 : 1}
            bg={item.selected ? "rgba(255,255,255,0.08)" : "transparent"}
            _hover={
              item.disabled
                ? undefined
                : { bg: "rgba(255,255,255,0.12)", color: "inherit" }
            }
            onClick={() => !item.disabled && item.onClick()}
            alignItems="center"
          >
            {item.icon && <item.icon size={14} />}
            <Box
              minW={0}
              textAlign="left"
              fontSize="xs"
              flex="1"
              color={item.danger ? "red.500" : "inherit"}
            >
              <Text>{item.label}</Text>
            </Box>
            {item.selected && (
              <Box fontSize="xs" flexShrink={0}>
                ✓
              </Box>
            )}
          </HStack>
        ))}
      </DropdownSurface>
    </Box>
  );
};

import {
  Box,
  BoxProps,
  Button,
  ButtonProps,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuChevronDown } from "react-icons/lu";
import { DropdownSurface } from "@/components/common/dropdown-menu";

type OptionValue = string;
type OptionLabel = React.ReactNode | { title: string; desc: string };

type MenuSelectorOption =
  | OptionValue
  | { value: OptionValue; label: OptionLabel; disabled?: boolean };

export interface MenuSelectorProps {
  options: MenuSelectorOption[];
  value: OptionValue | OptionValue[] | null;
  onSelect: (value: OptionValue | OptionValue[] | null) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  size?: string;
  fontSize?: string;
  buttonProps?: ButtonProps;
  menuListProps?: BoxProps;
  placement?: "top" | "bottom";
}

// Hand-rolled dropdown (docs/design/DESIGN-settings.md): Chakra's Menu paints
// invisibly in the Tauri WebKitGTK webview (portal + framer-motion layer).
// This renders a plain absolutely-positioned list in the page flow — no
// portal, no animation — which WebKitGTK always paints.
export const MenuSelector: React.FC<MenuSelectorProps> = ({
  options,
  value,
  onSelect,
  multiple = false,
  placeholder = "",
  disabled = false,
  size = "xs",
  fontSize = "xs",
  buttonProps,
  menuListProps,
  placement = "bottom",
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const buildOptions = (opt: MenuSelectorOption) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt;

  const isTitleDescLabel = (
    label: OptionLabel
  ): label is { title: string; desc: string } =>
    typeof label === "object" && label !== null && "title" in label;

  const renderLabel = (label: OptionLabel) => {
    if (isTitleDescLabel(label)) {
      return (
        <VStack spacing={0} alignItems="flex-start">
          <Text fontSize={fontSize}>{label.title}</Text>
          {label.desc && (
            <Text fontSize="xs" className="secondary-text">
              {label.desc}
            </Text>
          )}
        </VStack>
      );
    }
    return label;
  };

  const renderButtonLabel = () => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return placeholder;
    }

    const getLabel = (val: OptionValue) => {
      const match = options.find((opt) => buildOptions(opt).value === val);
      const label = match ? buildOptions(match).label : val;
      return isTitleDescLabel(label) ? label.title : label;
    };

    if (multiple && Array.isArray(value)) {
      return value.length <= 3
        ? value.map(getLabel).join(", ")
        : t("MenuSelector.selectedCount", { count: value.length });
    }

    return getLabel(value as OptionValue);
  };

  const isSelected = (v: OptionValue) =>
    multiple ? Array.isArray(value) && value.includes(v) : value === v;

  const pick = (v: OptionValue) => {
    if (multiple) {
      const arr = Array.isArray(value) ? value : [];
      onSelect(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    } else {
      onSelect(v);
      setOpen(false);
    }
  };

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // viewport-fixed surface: cards/navbars use overflow clipping, so the list
  // must not live inside them.
  return (
    <Box
      ref={rootRef}
      position="relative"
      display="inline-block"
      flexShrink={0}
      className="menu-selector"
    >
      <Button
        rightIcon={<LuChevronDown />}
        isDisabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        size={size}
        variant="outline"
        textAlign="left"
        w="auto"
        flexShrink={0}
        {...buttonProps}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        {renderButtonLabel()}
      </Button>
      <DropdownSurface
        rootRef={rootRef}
        open={open}
        placement={placement}
        {...menuListProps}
      >
        {options.map((opt, i) => {
          const { value: v, label, disabled: optDisabled } = buildOptions(opt);
          const selected = isSelected(v);
          return (
            <HStack
              key={i}
              as="button"
              type="button"
              role="option"
              aria-selected={selected}
              w="100%"
              px={3}
              py={1.5}
              gap={2}
              cursor={optDisabled ? "not-allowed" : "pointer"}
              opacity={optDisabled ? 0.4 : 1}
              bg={selected ? "rgba(255,255,255,0.08)" : "transparent"}
              _hover={
                optDisabled
                  ? undefined
                  : { bg: "rgba(255,255,255,0.12)", color: "inherit" }
              }
              onClick={() => !optDisabled && pick(v)}
              alignItems="center"
            >
              <Box
                w="14px"
                h="14px"
                flexShrink={0}
                display="flex"
                alignItems="center"
                justifyContent="center"
                {...(multiple
                  ? {
                      border: "1px solid",
                      borderColor: selected ? "#FAFAFA" : "line",
                      borderRadius: "2px",
                      bg: selected ? "#FAFAFA" : "transparent",
                    }
                  : {})}
              >
                {selected && (
                  <LuCheck size={12} color={multiple ? "#0A0A0A" : "#FAFAFA"} />
                )}
              </Box>
              <Box minW={0} textAlign="left" fontSize={fontSize}>
                {renderLabel(label)}
              </Box>
            </HStack>
          );
        })}
      </DropdownSurface>
    </Box>
  );
};
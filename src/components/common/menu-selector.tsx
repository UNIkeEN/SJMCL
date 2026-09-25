import {
  Button,
  ButtonProps,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuListProps,
  MenuOptionGroup,
  MenuProps,
  Text,
  VStack,
} from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";
import { type ListRowRenderer, List as VirtualList } from "react-virtualized";

type OptionValue = string;
type OptionLabel = React.ReactNode | { title: string; desc: string };

type MenuSelectorOption =
  | OptionValue
  | { value: OptionValue; label: OptionLabel; disabled?: boolean };

export interface MenuSelectorProps extends Omit<MenuProps, "children"> {
  options: MenuSelectorOption[];
  value: OptionValue | OptionValue[] | null;
  onSelect: (value: OptionValue | OptionValue[] | null) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  size?: string;
  fontSize?: string;
  buttonProps?: ButtonProps;
  menuListProps?: MenuListProps;

  // for virtualized list
  virtualized?: boolean;
  virtualRowHeight?: number;
  virtualListHeight?: number;
  virtualListWidth?: number;
  virtualOverscan?: number;
}

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

  virtualized = false,
  virtualRowHeight = 34,
  virtualListHeight = 320,
  virtualListWidth = 280,
  virtualOverscan = 10,

  ...menuProps
}) => {
  const { t } = useTranslation();
  const buildOptions = (opt: MenuSelectorOption) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt;

  const isTitleDescLabel = (
    label: OptionLabel
  ): label is { title: string; desc: string } =>
    typeof label === "object" &&
    label !== null &&
    "title" in label &&
    "desc" in label;

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

  // -------------------------------------------------
  const normalizedOptions = options.map(buildOptions);

  const renderOption = (
    opt: ReturnType<typeof buildOptions>,
    key: React.Key,
    style?: React.CSSProperties
  ) => {
    const { value: optionValue, label, disabled: optionDisabled } = opt;

    return (
      <MenuItemOption
        key={key}
        value={optionValue}
        fontSize={fontSize}
        isDisabled={optionDisabled}
        style={style}
        display="flex"
        alignItems="center"
        whiteSpace="nowrap"
        overflow="hidden"
        textOverflow="ellipsis"
      >
        {renderLabel(label)}
      </MenuItemOption>
    );
  };

  const selectedIndex =
    !multiple && typeof value === "string"
      ? normalizedOptions.findIndex((option) => option.value === value)
      : -1;

  // When virtualized, MenuItemOption is not a direct child of MenuOptionGroup,
  // so Chakra's cloneElement-based onClick/isChecked injection (see useMenuOptionGroup)
  // never reaches it. We manage selection here instead.
  const rowRenderer: ListRowRenderer = ({ index, key, style }) => {
    const opt = normalizedOptions[index];
    const { value: optionValue } = opt;
    const isChecked = multiple
      ? Array.isArray(value) && value.includes(optionValue)
      : optionValue === value;
    const handleSelect = () => {
      if (multiple) {
        const arr = Array.isArray(value) ? value : [];
        onSelect(
          arr.includes(optionValue)
            ? arr.filter((v) => v !== optionValue)
            : arr.concat(optionValue)
        );
      } else {
        onSelect(optionValue);
      }
    };
    return (
      <MenuItemOption
        key={key}
        value={optionValue}
        fontSize={fontSize}
        style={style}
        isChecked={isChecked}
        onClick={handleSelect}
        display="flex"
        alignItems="center"
        whiteSpace="nowrap"
        overflow="hidden"
        textOverflow="ellipsis"
      >
        {renderLabel(opt.label)}
      </MenuItemOption>
    );
  };

  const actualVirtualListHeight = Math.min(
    virtualListHeight,
    Math.max(1, normalizedOptions.length) * virtualRowHeight
  );

  // ----------------------------------------------------------
  return (
    <Menu closeOnSelect={!multiple} {...menuProps}>
      <MenuButton
        as={Button}
        rightIcon={
          menuProps.placement === "top" ? <LuChevronUp /> : <LuChevronDown />
        }
        isDisabled={disabled}
        size={size}
        variant="outline"
        textAlign="left"
        w="auto"
        flexShrink={0}
        {...buttonProps}
      >
        {renderButtonLabel()}
      </MenuButton>
      <MenuList {...menuListProps}>
        <MenuOptionGroup
          type={multiple ? "checkbox" : "radio"}
          value={value ?? (multiple ? [] : "")}
          onChange={(val) => {
            if (multiple) {
              onSelect(Array.isArray(val) ? val : []);
            } else {
              onSelect(typeof val === "string" ? val : null);
            }
          }}
        >
          {virtualized ? (
            <VirtualList
              width={virtualListWidth}
              height={actualVirtualListHeight}
              rowCount={normalizedOptions.length}
              rowHeight={virtualRowHeight}
              rowRenderer={rowRenderer}
              overscanRowCount={virtualOverscan}
              scrollToIndex={selectedIndex >= 0 ? selectedIndex : undefined}
              scrollToAlignment="center"
            />
          ) : (
            normalizedOptions.map((option) =>
              renderOption(option, option.value)
            )
          )}
        </MenuOptionGroup>
      </MenuList>
    </Menu>
  );
};

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

type OptionLabel = React.ReactNode | { title: string; desc: string };

interface SelectorOption {
  value: string;
  label: OptionLabel;
  disabled?: boolean;
}

export interface MenuSelectorProps extends Omit<MenuProps, "children"> {
  options: (string | SelectorOption)[];
  value: string | string[] | null;
  onSelect: (value: string | string[] | null) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  size?: string;
  fontSize?: string;
  buttonProps?: ButtonProps;
  menuListProps?: MenuListProps;
}

export interface VirtualMenuSelectorProps extends MenuSelectorProps {
  rowHeight?: number;
  listHeight?: number;
  listWidth?: number;
  overscan?: number;
}

const normalizeOption = (option: string | SelectorOption): SelectorOption =>
  typeof option === "string" ? { value: option, label: option } : option;

const isDetailLabel = (
  label: OptionLabel
): label is { title: string; desc: string } =>
  typeof label === "object" &&
  label !== null &&
  "title" in label &&
  "desc" in label;

const renderLabel = (label: OptionLabel, fontSize: string): React.ReactNode => {
  if (isDetailLabel(label)) {
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

const Selector: React.FC<
  MenuSelectorProps & {
    renderItems: (
      options: SelectorOption[],
      fontSize: string,
      selectedIndex: number
    ) => React.ReactNode;
  }
> = ({
  options,
  value,
  onSelect,
  size = "xs",
  fontSize = "xs",
  placeholder = "",
  disabled = false,
  multiple = false,
  buttonProps,
  menuListProps,
  renderItems,
  ...menuProps
}) => {
  const { t } = useTranslation();

  const normalizedOptions = options.map(normalizeOption);

  const getLabel = (selectedValue: string) => {
    const option = normalizedOptions.find(
      ({ value }) => value === selectedValue
    );
    const label = option ? option.label : selectedValue;
    return isDetailLabel(label) ? label.title : label;
  };

  const renderButtonLabel = () => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return placeholder;
    }
    if (multiple && Array.isArray(value)) {
      return value.length <= 3
        ? value.map(getLabel).join(", ")
        : t("MenuSelector.selectedCount", { count: value.length });
    }
    return getLabel(value as string);
  };

  const selectedIndex =
    !multiple && typeof value === "string"
      ? normalizedOptions.findIndex((option) => option.value === value)
      : -1;

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
          {renderItems(normalizedOptions, fontSize, selectedIndex)}
        </MenuOptionGroup>
      </MenuList>
    </Menu>
  );
};

export const MenuSelector: React.FC<MenuSelectorProps> = (props) => (
  <Selector
    {...props}
    renderItems={(options, fontSize) =>
      options.map(({ value, label, disabled }) => (
        <MenuItemOption
          key={value}
          value={value}
          fontSize={fontSize}
          isDisabled={disabled}
          display="flex"
          alignItems="center"
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
        >
          {renderLabel(label, fontSize)}
        </MenuItemOption>
      ))
    }
  />
);

export const VirtualMenuSelector: React.FC<VirtualMenuSelectorProps> = ({
  rowHeight = 34,
  listHeight = 320,
  listWidth = 280,
  overscan = 10,
  multiple = false,
  ...props
}) => {
  const { value, onSelect } = props;

  return (
    <Selector
      {...props}
      multiple={multiple}
      renderItems={(options, fontSize, selectedIndex) => {
        const rowRenderer: ListRowRenderer = ({ index, key, style }) => {
          const { value: optionValue } = options[index];
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
              {renderLabel(options[index].label, fontSize)}
            </MenuItemOption>
          );
        };
        return (
          <VirtualList
            width={listWidth}
            height={Math.min(
              listHeight,
              Math.max(1, options.length) * rowHeight
            )}
            rowCount={options.length}
            rowHeight={rowHeight}
            rowRenderer={rowRenderer}
            overscanRowCount={overscan}
            scrollToIndex={selectedIndex >= 0 ? selectedIndex : undefined}
            scrollToAlignment="center"
          />
        );
      }}
    />
  );
};

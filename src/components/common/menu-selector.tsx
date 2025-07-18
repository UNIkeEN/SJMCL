import {
  Button,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  MenuProps,
} from "@chakra-ui/react";
import React from "react";
import { LuChevronDown } from "react-icons/lu";

type OptionValue = string;
type OptionLabel = React.ReactNode;
type MenuSelectorOption =
  | OptionValue
  | { value: OptionValue; label: OptionLabel };

interface MenuSelectorProps {
  options: MenuSelectorOption[];
  value: OptionValue | OptionValue[] | null;
  onSelect: (value: OptionValue | OptionValue[] | null) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  size?: string;
  menuProps?: Partial<MenuProps>;
  menuListProps?: React.ComponentProps<typeof MenuList>;
}

export const MenuSelector: React.FC<MenuSelectorProps> = ({
  options,
  value,
  onSelect,
  multiple = false,
  placeholder = "Select...",
  disabled = false,
  size = "xs",
  menuProps,
  menuListProps,
}) => {
  const normalize = (opt: MenuSelectorOption) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt;

  const getLabelFromValue = (val: OptionValue) => {
    const match = options.find((opt) => normalize(opt).value === val);
    return match ? normalize(match).label : val;
  };

  const renderButtonLabel = () => {
    if (!value || (Array.isArray(value) && value.length === 0))
      return placeholder;

    if (multiple && Array.isArray(value)) {
      return value.length <= 3
        ? value.map(getLabelFromValue).join(", ")
        : `${value.length} selected`;
    }

    return getLabelFromValue(value as OptionValue);
  };

  return (
    <Menu closeOnSelect={!multiple} {...menuProps}>
      <MenuButton
        as={Button}
        rightIcon={<LuChevronDown />}
        isDisabled={disabled}
        size={size}
        variant="outline"
        textAlign="left"
        w="auto"
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
          {options.map((opt, i) => {
            const { value: v, label } = normalize(opt);
            return (
              <MenuItemOption key={i} value={v} fontSize="xs">
                {label}
              </MenuItemOption>
            );
          })}
        </MenuOptionGroup>
      </MenuList>
    </Menu>
  );
};

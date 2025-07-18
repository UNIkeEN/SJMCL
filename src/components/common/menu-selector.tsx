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
} from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";

type OptionValue = string;
type OptionLabel = React.ReactNode;

type MenuSelectorOption =
  | OptionValue
  | { value: OptionValue; label: OptionLabel };

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
  ...menuProps
}) => {
  const { t } = useTranslation();
  const buildOptions = (opt: MenuSelectorOption) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt;

  const getLabelFromValue = (val: OptionValue) => {
    const match = options.find((opt) => buildOptions(opt).value === val);
    return match ? buildOptions(match).label : val;
  };

  const renderButtonLabel = () => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return placeholder;
    }

    if (multiple && Array.isArray(value)) {
      return value.length <= 3
        ? value.map(getLabelFromValue).join(", ")
        : t("MenuSelector.selectedCount", { count: value.length });
    }

    return getLabelFromValue(value as OptionValue);
  };

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
          {options.map((opt, i) => {
            const { value: v, label } = buildOptions(opt);
            return (
              <MenuItemOption key={i} value={v} fontSize={fontSize}>
                {label}
              </MenuItemOption>
            );
          })}
        </MenuOptionGroup>
      </MenuList>
    </Menu>
  );
};

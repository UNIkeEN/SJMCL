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
  renderOptions?: (
    renderOption: (index: number, label?: OptionLabel) => React.ReactElement
  ) => React.ReactNode;
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
  renderOptions,
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

  const renderOption = (index: number, labelOverride?: OptionLabel) => {
    const { value: v, label, disabled } = buildOptions(options[index]);
    const selected = Array.isArray(value) ? value : [];
    const handleSelect = () => {
      if (multiple) {
        onSelect(
          selected.includes(v)
            ? selected.filter((item) => item !== v)
            : [...selected, v]
        );
      } else {
        onSelect(v);
      }
    };

    return (
      <MenuItemOption
        key={index}
        value={v}
        fontSize={fontSize}
        isDisabled={disabled}
        {...(renderOptions && {
          type: multiple ? "checkbox" : "radio",
          isChecked: multiple ? selected.includes(v) : value === v,
          onClick: handleSelect,
        })}
      >
        {renderLabel(labelOverride ?? label)}
      </MenuItemOption>
    );
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
        flexShrink={0}
        {...buttonProps}
      >
        {renderButtonLabel()}
      </MenuButton>
      <MenuList
        {...(renderOptions && { display: "flex", flexDirection: "column" })}
        {...menuListProps}
      >
        {renderOptions ? (
          renderOptions(renderOption)
        ) : (
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
            {options.map((_, index) => renderOption(index))}
          </MenuOptionGroup>
        )}
      </MenuList>
    </Menu>
  );
};

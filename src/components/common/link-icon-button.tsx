import { Icon, IconButton, IconButtonProps, Tooltip } from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import { useRouter } from "next/router";
import React from "react";
import { LuArrowRight, LuExternalLink } from "react-icons/lu";

interface LinkIconButtonProps extends IconButtonProps {
  url: string;
  isExternal?: boolean;
  size?: string;
  showTooltip?: boolean;
}

const LinkIconButton: React.FC<LinkIconButtonProps> = ({
  url,
  isExternal = false,
  showTooltip = false,
  size = "xs",
  ...buttonProps
}) => {
  const router = useRouter();

  return (
    <Tooltip
      label={url}
      fontSize={size}
      isDisabled={!showTooltip || buttonProps.isDisabled}
      aria-label={url}
      placement="bottom-end"
    >
      <IconButton
        onClick={() => {
          isExternal ? open(url) : router.push(url);
        }}
        variant="ghost"
        size="xs"
        icon={
          <Icon as={isExternal ? LuExternalLink : LuArrowRight} boxSize={3.5} />
        }
        {...buttonProps}
      />
    </Tooltip>
  );
};

export default LinkIconButton;

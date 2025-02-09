import { Icon, IconButton, IconButtonProps, Tooltip } from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRouter } from "next/router";
import React from "react";
import { LuArrowRight, LuExternalLink } from "react-icons/lu";

interface LinkIconButtonProps extends IconButtonProps {
  url: string;
  isExternal?: boolean;
  size?: string;
  withTooltip?: boolean;
}

const LinkIconButton: React.FC<LinkIconButtonProps> = ({
  url,
  isExternal = false,
  withTooltip = false,
  size = "xs",
  ...buttonProps
}) => {
  const router = useRouter();

  return (
    <Tooltip
      label={url}
      fontSize={size}
      isDisabled={!withTooltip || buttonProps.isDisabled}
      aria-label={url}
      placement="bottom-end"
    >
      <IconButton
        onClick={() => {
          isExternal ? openUrl(url) : router.push(url);
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

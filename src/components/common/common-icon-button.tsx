import {
  Icon,
  IconButton,
  IconButtonProps,
  PlacementWithLogical,
  Tooltip,
} from "@chakra-ui/react";
import { type } from "@tauri-apps/plugin-os";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import {
  LuArrowDownToLine,
  LuCircleHelp,
  LuFiles,
  LuFolderOpen,
  LuFolderSearch,
  LuInfo,
  LuPenLine,
  LuPlus,
  LuRefreshCcw,
  LuTrash,
} from "react-icons/lu";

interface CommonIconButtonProps
  extends Omit<IconButtonProps, "icon" | "aria-label"> {
  icon: string | IconType;
  label?: string;
  withTooltip?: boolean;
  tooltipPlacement?: PlacementWithLogical;
}

export const CommonIconButton: React.FC<CommonIconButtonProps> = ({
  icon,
  label,
  withTooltip = true,
  tooltipPlacement = "bottom",
  ...props
}) => {
  const { t } = useTranslation();

  const supportIcons: Record<string, JSX.Element> = {
    add: <LuPlus />,
    copyOrMove: <LuFiles />,
    delete: <LuTrash />,
    download: <LuArrowDownToLine />,
    edit: <LuPenLine />,
    info: <LuInfo />,
    open: <LuFolderOpen />,
    openFolder: <LuFolderOpen />,
    refresh: <LuRefreshCcw />,
    revealFile: <LuFolderSearch />,
  };

  const specLabels: Record<string, string> = {
    copyOrMove: t(`General.copyOrMove.${type()}`),
    revealFile: t("General.revealFile", {
      opener: t(`Enums.systemFileManager.${type()}`),
    }),
  };

  const selectedIcon =
    typeof icon === "string" ? (
      supportIcons[icon] || <LuCircleHelp />
    ) : (
      <Icon as={icon} />
    );

  const finalLabel =
    label ||
    (typeof icon === "string"
      ? specLabels[icon]
        ? specLabels[icon]
        : t(`General.${icon}`)
      : "");

  return (
    <Tooltip
      label={finalLabel}
      isDisabled={!withTooltip}
      key={finalLabel}
      placement={tooltipPlacement}
    >
      <IconButton
        icon={selectedIcon}
        aria-label={finalLabel}
        variant="ghost"
        size="sm"
        {...props}
      />
    </Tooltip>
  );
};

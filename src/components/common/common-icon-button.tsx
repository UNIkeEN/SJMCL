import {
  Icon,
  IconButton,
  IconButtonProps,
  PlacementWithLogical,
  Tooltip,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import {
  LuArrowDownToLine,
  LuCircleHelp,
  LuCopy,
  LuExternalLink,
  LuFiles,
  LuFolderOpen,
  LuFolderSearch,
  LuInfo,
  LuPenLine,
  LuPlay,
  LuPlus,
  LuRefreshCcw,
  LuShare,
  LuTrash,
} from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";

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
  const { config } = useLauncherConfig();

  const supportIcons: Record<string, JSX.Element> = {
    add: <LuPlus />,
    copy: <LuCopy />,
    copyOrMove: <LuFiles />,
    delete: <LuTrash />,
    download: <LuArrowDownToLine />,
    edit: <LuPenLine />,
    external: <LuExternalLink size="14" />, // keep the same as deprecated link-icon-button
    info: <LuInfo />,
    launch: <LuPlay />,
    open: <LuFolderOpen />,
    openFolder: <LuFolderOpen />,
    refresh: <LuRefreshCcw />,
    revealFile: <LuFolderSearch />,
    share: <LuShare />,
  };

  const specLabels: Record<string, string> = {
    copy: t("General.copy.text"),
    copyOrMove: t(`General.copyOrMove.${config.basicInfo.osType}`),
    revealFile: t("General.revealFile", {
      opener: t(`Enums.systemFileManager.${config.basicInfo.osType}`),
    }),
    share: t("General.share.text"),
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

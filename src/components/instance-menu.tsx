import { HStack, IconButton } from "@chakra-ui/react";
import { openPath } from "@tauri-apps/plugin-opener";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  LuEllipsis,
  LuFolderOpen,
  LuLayoutList,
  LuTrash,
} from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { DropdownMenu } from "@/components/common/dropdown-menu";
import { useSharedModals } from "@/contexts/shared-modal";
import { InstanceSummary } from "@/models/instance/misc";

interface InstanceMenuProps {
  instance: InstanceSummary;
  variant?: "dropdown" | "buttonGroup";
}

export const InstanceMenu: React.FC<InstanceMenuProps> = ({
  instance,
  variant = "dropdown",
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { openSharedModal } = useSharedModals();

  const instanceMenuOperations = [
    {
      icon: LuFolderOpen,
      label: t("General.openFolder"),
      onClick: async () => {
        await openPath(instance.versionPath);
      },
    },
    {
      icon: LuLayoutList,
      label: t("InstanceMenu.label.details"),
      onClick: () => {
        router.push({
          pathname: "/instances/details/[id]",
          query: { id: instance.id },
        });
      },
    },
    {
      icon: LuTrash,
      label: t("InstanceMenu.label.delete"),
      danger: true,
      onClick: () => {
        openSharedModal("delete-instance-alert", { instance });
      },
    },
  ];

  return (
    <>
      {variant === "dropdown" ? (
        <DropdownMenu
          trigger={(p) => (
            <IconButton
              size="xs"
              variant="ghost"
              aria-label="operations"
              icon={<LuEllipsis />}
              {...p}
            />
          )}
          items={instanceMenuOperations.map((item) => ({
            icon: item.icon,
            label: item.label,
            danger: item.danger,
            onClick: item.onClick,
          }))}
        />
      ) : (
        <HStack spacing={0}>
          {instanceMenuOperations.map((item) => (
            <CommonIconButton
              key={item.label}
              icon={item.icon}
              label={item.label}
              colorScheme={item.danger ? "red" : "gray"}
              onClick={item.onClick}
            />
          ))}
        </HStack>
      )}
    </>
  );
};

export default InstanceMenu;

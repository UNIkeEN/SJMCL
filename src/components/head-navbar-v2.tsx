import { Flex, Icon, Tooltip } from "@chakra-ui/react";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import {
  LuArrowDownToLine,
  LuBox,
  LuCircleUserRound,
  LuSettings,
} from "react-icons/lu";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import styles from "@/styles/homebar.module.css";

// easy-launcher homebar (docs/design/DESIGN-homebar.md): bottom icon bar only —
// two route icons left, the play button, two route icons right. Monochrome.

interface RouteItem {
  icon: IconType;
  label: string;
  path: string;
}

const leftRoutes: RouteItem[] = [
  { icon: LuBox, label: "instances", path: "/instances" },
  { icon: LuCircleUserRound, label: "accounts", path: "/accounts" },
];

const rightRoutes: RouteItem[] = [
  { icon: LuArrowDownToLine, label: "downloads", path: "/downloads" },
  { icon: LuSettings, label: "settings", path: "/settings" },
];

const HeadNavBar = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { openSharedModal } = useSharedModals();
  const { selectedInstance } = useGlobalData();

  const handleLaunch = () => {
    if (selectedInstance) {
      openSharedModal("launch", { instanceId: selectedInstance.id });
    } else {
      router.push("/instances");
    }
  };

  const renderRouteButton = (item: RouteItem) => (
    <Tooltip
      key={item.path}
      label={t(`HeadNavBar.navList.${item.label}`)}
      placement="top"
    >
      <button
        type="button"
        aria-label={t(`HeadNavBar.navList.${item.label}`)}
        aria-current={
          router.pathname.startsWith(item.path) ? "page" : undefined
        }
        className={`${styles.icon} ${
          router.pathname.startsWith(item.path) ? styles.iconActive : ""
        }`}
        onClick={() => router.push(item.path)}
      >
        <Icon as={item.icon} />
      </button>
    </Tooltip>
  );

  return (
    <Flex
      as="footer"
      role="toolbar"
      className={styles.bar}
      position="fixed"
      bottom="28px"
      left="50%"
      transform="translateX(-50%)"
      zIndex={20}
    >
      {leftRoutes.map(renderRouteButton)}

      <button
        type="button"
        className={styles.play}
        onClick={handleLaunch}
        aria-label={t("LaunchPage.button.launch")}
      >
        {t("LaunchPage.button.launch")}
        {selectedInstance?.version && (
          <small className={styles.playVersion}>
            {selectedInstance.version}
          </small>
        )}
      </button>

      {rightRoutes.map(renderRouteButton)}
    </Flex>
  );
};

export default HeadNavBar;

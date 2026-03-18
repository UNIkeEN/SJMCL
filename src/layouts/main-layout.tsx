import {
  Button,
  Center,
  Flex,
  HStack,
  Link,
  Text,
  useColorMode,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, appLogDir, join } from "@tauri-apps/api/path";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { exit } from "@tauri-apps/plugin-process";
import { t } from "i18next";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Trans } from "react-i18next";
import { LuLanguages, LuScrollText } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import AdvancedCard from "@/components/common/advanced-card";
import DevToolbar from "@/components/dev/dev-toolbar";
import HeadNavBar from "@/components/head-navbar-v2";
import LanguageMenu from "@/components/language-menu";
import MainWindowTitlebar from "@/components/main-window-titlebar";
import StarUsModal from "@/components/modals/star-us-modal";
import WelcomeAndTermsModal from "@/components/modals/welcome-and-terms-modal";
import { useLauncherConfig } from "@/contexts/config";
import { useSharedModals } from "@/contexts/shared-modal";
import { isDev } from "@/utils/env";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const router = useRouter();
  const isStandAlone = router.pathname.startsWith("/standalone");
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { colorMode } = useColorMode();
  const isDarkenBg =
    colorMode === "dark" && config.appearance.background.autoDarken;
  const { openGenericConfirmDialog } = useSharedModals();

  const [bgImgSrc, setBgImgSrc] = useState<string>("");
  const isCheckedRunCount = useRef(false);
  const isCheckedLastRunStatus = useRef(false);

  const {
    isOpen: isWelcomeAndTermsModalOpen,
    onOpen: onWelcomeAndTermsModalOpen,
    onClose: onWelcomeAndTermsModalClose,
  } = useDisclosure();

  const {
    isOpen: isStarUsModalOpen,
    onOpen: onStarUsModalOpen,
    onClose: onStarUsModalClose,
  } = useDisclosure();

  const openUnavailableExePathDialog = useCallback(() => {
    openGenericConfirmDialog({
      title: t("UnavailableExePathAlertDialog.dialog.title"),
      body: t("UnavailableExePathAlertDialog.dialog.content"),
      btnCancel: t("UnavailableExePathAlertDialog.dialog.btnContinue"),
      onCancelCallback: () => update("runCount", config.runCount + 1), // because this dialog will skip the run count check
      btnOK: t("General.exit"),
      onOKCallback: () => exit(0),
      footerLeft: (
        <HStack spacing={2}>
          <LuLanguages />
          <LanguageMenu placement="top" />
        </HStack>
      ),
      isAlert: true,
      closeOnEsc: false,
      closeOnOverlayClick: false,
      showCloseBtn: false,
    });
  }, [config.runCount, openGenericConfirmDialog, update]);

  const openLastExitedAbnormallyDialog = useCallback(() => {
    openGenericConfirmDialog({
      title: t("LastExitedAbnormallyDialog.dialog.title"),
      btnCancel: "",
      showSuppressBtn: true,
      suppressKey: "lastExitedAbnormally",
      body: (
        <Text color="gray.500">
          <Trans
            i18nKey="LastExitedAbnormallyDialog.dialog.content"
            components={{
              community: (
                <Link
                  color={`${primaryColor}.500`}
                  onClick={() =>
                    openUrl(t("HelpSettingsPage.top.settings.UserGroup.url"))
                  }
                />
              ),
              github: (
                <Link
                  color={`${primaryColor}.500`}
                  onClick={() =>
                    openUrl("https://github.com/UNIkeEN/SJMCL/issues")
                  }
                />
              ),
            }}
          />
        </Text>
      ),
      footerLeft: (
        <HStack>
          <LuScrollText />
          <Button
            variant="link"
            colorScheme={primaryColor}
            onClick={async () => {
              const _appLogDir = await appLogDir();
              const launcherLogDir = await join(_appLogDir, "launcher");
              await openPath(launcherLogDir);
            }}
          >
            {t("LastExitedAbnormallyDialog.dialog.viewLog")}
          </Button>
        </HStack>
      ),
    });
  }, [openGenericConfirmDialog, primaryColor]);

  useEffect(() => {
    // running in unavailable path, show alert dialog.
    if (!config.mocked && !config.basicInfo.isExePathAvailable) {
      openUnavailableExePathDialog();
      isCheckedRunCount.current = true; // skip run count check below
    }

    // update `last_run_exited_normally` to false, will be updated when this run ends with normal exit.
    if (!config.mocked && !isCheckedLastRunStatus.current && !isStandAlone) {
      if (!config.lastRunExitedNormally) {
        openLastExitedAbnormallyDialog();
      }
      update("lastRunExitedNormally", false);
      isCheckedLastRunStatus.current = true;
    }

    // update run count, conditionally show some modals.
    if (!config.mocked && !isCheckedRunCount.current && !isStandAlone) {
      if (!config.runCount) {
        setTimeout(() => {
          onWelcomeAndTermsModalOpen();
        }, 300); // some delay to avoid sudden popup
      } else {
        let newCount = config.runCount + 1;
        if (newCount === 10) {
          setTimeout(() => {
            onStarUsModalOpen();
          }, 300);
        }
        update("runCount", newCount);
      }
      isCheckedRunCount.current = true;
    }
  }, [
    config.mocked,
    config.runCount,
    config.lastRunExitedNormally,
    config.basicInfo.isExePathAvailable,
    isStandAlone,
    openLastExitedAbnormallyDialog,
    openUnavailableExePathDialog,
    onWelcomeAndTermsModalOpen,
    onStarUsModalOpen,
    update,
  ]);

  // construct background img src url from config.
  useEffect(() => {
    const constructBgImgSrc = async () => {
      const bgKey = config.appearance.background.choice;
      if (bgKey.startsWith("%built-in:")) {
        setBgImgSrc(
          `/images/backgrounds/${bgKey.replace("%built-in:", "")}.jpg`
        );
      } else {
        const _appDataDir = await appDataDir();
        setBgImgSrc(
          convertFileSrc(`${_appDataDir}/UserContent/Backgrounds/${bgKey}`) +
            `?t=${Date.now()}`
        );
      }
    };

    constructBgImgSrc();
  }, [config.appearance.background.choice]);

  // update font family to body CSS by config.
  useEffect(() => {
    const body = document.body;
    const fontFamily = config.appearance.font.fontFamily;

    if (fontFamily !== "%built-in") {
      body.setAttribute("use-custom-font", "true");
      body.style.setProperty("--custom-global-font-family", fontFamily);
    } else {
      body.removeAttribute("use-custom-font");
      body.style.removeProperty("--custom-global-font-family");
    }
  }, [config.appearance.font.fontFamily]);

  // update font size to body CSS by config.
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const prevMd =
      parseFloat(
        getComputedStyle(root).getPropertyValue("--chakra-fontSizes-md")
      ) || 1;
    const ratio =
      Math.min(115, Math.max(85, config.appearance.font.fontSize)) /
      100 /
      prevMd;

    const computedStyle = getComputedStyle(root);
    for (let i = 0; i < computedStyle.length; i++) {
      const key = computedStyle[i];
      if (key.startsWith("--chakra-fontSizes-")) {
        const originalValue =
          parseFloat(computedStyle.getPropertyValue(key)) || 1;
        body.style.setProperty(key, `${originalValue * ratio}rem`, "important");
      }
    }
  }, [config.appearance.font.fontSize]);

  const getGlobalExtraStyle = (config: any) => {
    const isInvertColors = config.appearance.accessibility.invertColors;
    const enhanceContrast = config.appearance.accessibility.enhanceContrast;

    const filters = [];
    if (isInvertColors) filters.push("invert(1)");
    if (enhanceContrast) filters.push("contrast(1.2)");

    return {
      filter: filters.length > 0 ? filters.join(" ") : "none",
    };
  };

  const standaloneBgColor = useColorModeValue(
    "white",
    "var(--chakra-colors-gray-900)"
  );

  if (isStandAlone) {
    return (
      <div
        style={{
          ...getGlobalExtraStyle(config),
          backgroundColor: standaloneBgColor,
        }}
      >
        {children}
        {isDev && <DevToolbar />}
      </div>
    );
  }

  if (config.mocked)
    return (
      <Center h="100vh" style={getGlobalExtraStyle(config)}>
        <BeatLoader size={16} color="gray" />
      </Center>
    );

  return (
    <Flex
      direction="column"
      h="100vh"
      bgImg={`url('${bgImgSrc}')`}
      bgSize="cover"
      bgPosition="center"
      bgRepeat="no-repeat"
      bgColor={isDarkenBg ? "rgba(0,0,0,0.45)" : "transparent"}
      bgBlendMode={isDarkenBg ? "darken" : "normal"}
      {...(config.basicInfo.osType === "linux" && {
        border: "0.5px solid",
        borderColor: "gray.500",
        borderRadius: "lg",
      })}
      overflow="hidden"
      style={getGlobalExtraStyle(config)}
    >
      <MainWindowTitlebar />
      <HeadNavBar />
      {router.pathname === "/launch" ? (
        <>{children}</>
      ) : (
        <AdvancedCard
          level="back"
          h="100%"
          overflow="auto"
          mt={1}
          mb={4}
          mx={4}
        >
          {children}
        </AdvancedCard>
      )}

      <WelcomeAndTermsModal
        isOpen={isWelcomeAndTermsModalOpen}
        onClose={onWelcomeAndTermsModalClose}
      />
      <StarUsModal isOpen={isStarUsModalOpen} onClose={onStarUsModalClose} />

      {isDev && <DevToolbar />}
    </Flex>
  );
};

export default MainLayout;

import { Flex, HStack, Image, Text, useColorModeValue } from "@chakra-ui/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuMaximize2, LuMinimize2, LuMinus, LuX } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { useLauncherConfig } from "@/contexts/config";
import { useExtensionHost } from "@/contexts/extension/host";

const MainWindowExtensionTitle = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { extensionList } = useExtensionHost();

  const textColor = useColorModeValue("blackAlpha.600", "whiteAlpha.700");

  const extensionIdentifier = (() => {
    if (!router.isReady) return undefined;
    const path = router.asPath.split("?")[0];
    if (path.startsWith("/extension/")) {
      return decodeURIComponent(path.slice("/extension/".length).split("/")[0]);
    }
    if (path.startsWith("/extensions/")) {
      return decodeURIComponent(
        path.slice("/extensions/".length).split("/")[0]
      );
    }
    return undefined;
  })();

  const extensionName = extensionList?.find(
    (extension) => extension.identifier === extensionIdentifier
  )?.name;

  if (!extensionName) return null;

  return (
    <Flex
      position="absolute"
      inset={0}
      align="center"
      justify="center"
      pointerEvents="none"
    >
      <Text fontSize="xs-sm" color={textColor}>
        {t("WindowTitlebar.extensionProvidedPage", {
          name: extensionName,
        })}
      </Text>
    </Flex>
  );
};

const WindowTitlebar = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { config } = useLauncherConfig();
  const osType = config.basicInfo.osType;

  const isLinux = osType === "linux";
  const isMac = osType === "macos" || osType === "darwin";
  const isWindows = osType === "windows";

  const titlebarHeight = isWindows ? 32 : 28; // the same as Windows 11 / macOS 15 native titlebar height.

  const [isMacFullscreen, setIsMacFullscreen] = useState(false);
  const [isLinuxMaximized, setIsLinuxMaximized] = useState(false);
  const [isMainWindow, setIsMainWindow] = useState(true);
  const [windowTitle, setWindowTitle] = useState("");

  const titlebarBg = useColorModeValue("whiteAlpha.600", "blackAlpha.500");
  const titlebarBorderColor = useColorModeValue(
    "blackAlpha.200",
    "whiteAlpha.300"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentWindow = getCurrentWindow();
    const isMain = currentWindow.label === "main";
    setIsMainWindow(isMain);

    if (isMain) return;

    const titleKey: string | undefined = {
      "/standalone/game-error": "Tauri.windowTitle.gameError",
      "/standalone/game-log": "Tauri.windowTitle.gameLog",
    }[router.pathname];

    (async () => {
      if (titleKey) {
        const title = t(titleKey);
        setWindowTitle(title);
      } else {
        setWindowTitle(await currentWindow.title());
      }
    })();
  }, [router.pathname, t]);

  const linuxWindowButtons = [
    {
      icon: LuMinus,
      label: "Minimize",
      onClick: async () => {
        await getCurrentWindow().minimize();
      },
    },
    {
      icon: isLinuxMaximized ? LuMinimize2 : LuMaximize2,
      label: "Maximize",
      onClick: async () => {
        await getCurrentWindow().toggleMaximize();
      },
    },
    {
      icon: LuX,
      label: "Close",
      onClick: async () => {
        await getCurrentWindow().close();
      },
      colorScheme: "red",
    },
  ];

  // Prevent top-area clicks from closing modal overlay.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const blockOverlayCloseAtTop = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.clientY <= titlebarHeight &&
        document.querySelector(".chakra-modal__overlay") &&
        !target?.closest(
          "[data-titlebar-control], .decorum-tb-btn, [data-tauri-decorum-tb]"
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", blockOverlayCloseAtTop, true);
    return () => {
      document.removeEventListener("click", blockOverlayCloseAtTop, true);
    };
  }, [titlebarHeight]);

  // Listen linux window maximize/unmaximize, change maximize icon accordingly.
  useEffect(() => {
    if (typeof window === "undefined" || !isLinux) return;
    const currentWindow = getCurrentWindow();
    let unlistenResized: (() => void) | undefined;
    const syncMaximized = async () => {
      setIsLinuxMaximized(await currentWindow.isMaximized());
    };

    (async () => {
      await syncMaximized();
      unlistenResized = await currentWindow.onResized(syncMaximized);
    })();

    return () => {
      if (unlistenResized) {
        unlistenResized();
      }
    };
  }, [isLinux]);

  // Remove decorum fallback titlebar if it was created before React host mounted.
  useEffect(() => {
    if (typeof window === "undefined" || !isWindows) return;
    const host = document.getElementById("sjmcl-window-decorum-host");
    if (!host) return;

    const allHosts = Array.from(
      document.querySelectorAll<HTMLElement>("[data-tauri-decorum-tb]")
    );

    allHosts.forEach((el) => {
      if (el === host) return;
      const buttons = Array.from(
        el.querySelectorAll<HTMLElement>(".decorum-tb-btn")
      );
      if (
        buttons.length > 0 &&
        host.querySelector(".decorum-tb-btn") === null
      ) {
        buttons.forEach((btn) => host.appendChild(btn));
      }
      el.remove();
    });
  }, [isWindows]);

  // Listen macOS native fullscreen mode, make titlebar hidden.
  useEffect(() => {
    if (typeof window === "undefined" || !isMac) return;
    const currentWindow = getCurrentWindow();
    let unlistenResized: (() => void) | undefined;
    const syncFullscreen = async () => {
      setIsMacFullscreen(await currentWindow.isFullscreen());
    };
    (async () => {
      await syncFullscreen();
      unlistenResized = await currentWindow.onResized(syncFullscreen);
    })();

    return () => {
      if (unlistenResized) {
        unlistenResized();
      }
    };
  }, [isMac]);

  if (isMac && isMacFullscreen) return null;

  return (
    <Flex
      h={`${titlebarHeight}px`}
      minH={`${titlebarHeight}px`}
      bg={titlebarBg}
      backdropFilter="blur(3px) saturate(140%)"
      borderBottom="1px solid"
      borderColor={titlebarBorderColor}
      zIndex={9999}
      pl={2}
    >
      {isMainWindow && !router.pathname.startsWith("/standalone") && (
        <MainWindowExtensionTitle />
      )}
      <Flex
        id="sjmcl-window-drag-region"
        data-tauri-drag-region
        flex="1"
        h="100%"
        align="center"
      >
        {(isWindows || isLinux) && (
          <Image
            src="/images/icons/Logo_32x32.png"
            alt="SJMCL"
            boxSize="16px"
          />
        )}
        {!isMainWindow && windowTitle && (
          <Text
            ml={isMac ? 16 : 2}
            fontSize="xs-sm"
            fontWeight="semibold"
            noOfLines={1}
          >
            {windowTitle}
          </Text>
        )}
      </Flex>
      {isWindows && (
        <HStack
          id="sjmcl-window-decorum-host"
          data-tauri-decorum-tb
          spacing={0}
          h="100%"
        />
      )}
      {isLinux && (
        <HStack spacing={0} h="100%" align="center" pr={2}>
          {linuxWindowButtons.map((button) => (
            <CommonIconButton
              key={button.label}
              data-titlebar-control
              icon={button.icon}
              label={button.label}
              withTooltip={false}
              borderRadius="full"
              h={18}
              colorScheme={button.colorScheme}
              onClick={button.onClick}
            />
          ))}
        </HStack>
      )}
    </Flex>
  );
};

export default WindowTitlebar;

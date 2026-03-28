import { Flex, HStack, Image, useColorModeValue } from "@chakra-ui/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { LuMaximize2, LuMinimize2, LuMinus, LuX } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { useLauncherConfig } from "@/contexts/config";

const MainWindowTitlebar = () => {
  const { config } = useLauncherConfig();
  const osType = config.basicInfo.osType;

  const isLinux = osType === "linux";
  const isMac = osType === "macos" || osType === "darwin";
  const isWindows = osType === "windows";

  const titlebarHeight = isWindows ? 32 : 28; // the same as Windows 11 / macOS 15 native titlebar height.

  const [isMacFullscreen, setIsMacFullscreen] = useState(false);
  const [isLinuxMaximized, setIsLinuxMaximized] = useState(false);

  const titlebarBg = useColorModeValue("whiteAlpha.600", "blackAlpha.500");
  const titlebarBorderColor = useColorModeValue(
    "blackAlpha.200",
    "whiteAlpha.300"
  );

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

    void syncMaximized();
    currentWindow
      .onResized(() => {
        void syncMaximized();
      })
      .then((unlisten) => {
        unlistenResized = unlisten;
      });

    return () => {
      if (unlistenResized) {
        unlistenResized();
      }
    };
  }, [isLinux]);

  // Remove decorum fallback titlebar if it was created before React host mounted.
  useEffect(() => {
    if (typeof window === "undefined" || !isWindows) return;
    const host = document.getElementById("sjmcl-main-decorum-host");
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
    void syncFullscreen();
    currentWindow
      .onResized(() => {
        void syncFullscreen();
      })
      .then((unlisten) => {
        unlistenResized = unlisten;
      });

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
      <Flex
        id="sjmcl-main-drag-region"
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
      </Flex>
      {isWindows && (
        <HStack
          id="sjmcl-main-decorum-host"
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

export default MainWindowTitlebar;

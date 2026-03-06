import {
  Box,
  Center,
  Flex,
  useColorMode,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BeatLoader } from "react-spinners";
import AgentHostess from "@/components/agent-hostess";
import AdvancedCard from "@/components/common/advanced-card";
import DevToolbar from "@/components/dev/dev-toolbar";
import HeadNavBar from "@/components/head-navbar";
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
  const { config, update } = useLauncherConfig();
  const { openSharedModal } = useSharedModals();
  const { colorMode } = useColorMode();
  const isDarkenBg =
    colorMode === "dark" && config.appearance.background.autoDarken;

  const [bgImgSrc, setBgImgSrc] = useState<string>("");
  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false);
  const agentChatFrameRef = useRef<HTMLIFrameElement | null>(null);
  const isCheckedRunCount = useRef(false);
  const isStandAlone = router.pathname.startsWith("/standalone");
  const isLaunchPage = router.pathname === "/launch";
  const agentChatPanelRatio = 0.35;
  const agentChatPanelWidth = `${agentChatPanelRatio * 100}vw`;
  const agentChatPanelTransform =
    isLaunchPage && isAgentChatOpen ? "translateX(0)" : "translateX(-100%)";
  const launchContentOffset =
    isLaunchPage && isAgentChatOpen ? agentChatPanelWidth : "0px";
  const headNavOffset =
    isLaunchPage && isAgentChatOpen
      ? `${(agentChatPanelRatio * 100) / 2}vw`
      : "0px";

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

  // update run count, conditionally show some modals.
  useEffect(() => {
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
    isStandAlone,
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

  // Bridge MiuChat iframe events to top-level shared modal system.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type !== "sjmcl:miuchat-launch-instance") {
        return;
      }

      const instanceId = data?.payload?.instanceId;
      if (typeof instanceId !== "string" || !instanceId) {
        return;
      }

      openSharedModal("launch", { instanceId });
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [openSharedModal]);

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

  const notifyAgentChatTextVisibility = useCallback((visible: boolean) => {
    agentChatFrameRef.current?.contentWindow?.postMessage(
      {
        type: "sjmcl:miuchat-text-visibility",
        payload: { visible },
      },
      "*"
    );
  }, []);

  const openAgentChatPanel = () => {
    setIsAgentChatOpen(true);
    setTimeout(() => {
      notifyAgentChatTextVisibility(true);
    }, 180);
  };

  const closeAgentChatPanel = useCallback(() => {
    notifyAgentChatTextVisibility(false);
    setIsAgentChatOpen(false);
  }, [notifyAgentChatTextVisibility]);

  // When MiuChat is open, clicking anywhere on the right window area closes it.
  useEffect(() => {
    if (!isLaunchPage || !isAgentChatOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const panelWidth = window.innerWidth * agentChatPanelRatio;
      if (event.clientX > panelWidth) {
        closeAgentChatPanel();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isLaunchPage, isAgentChatOpen, closeAgentChatPanel]);

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
      style={getGlobalExtraStyle(config)}
    >
      <HeadNavBar leftOffset={headNavOffset} />
      {/* Keep iframe mounted to avoid reloading MiuChat when switching pages. */}
      <Flex
        position="fixed"
        left={0}
        top={0}
        h="100vh"
        w={agentChatPanelWidth}
        overflow="hidden"
        transform={agentChatPanelTransform}
        transition="transform 0.35s ease"
        borderRightWidth={1}
        borderRightColor={
          isLaunchPage && isAgentChatOpen ? "blackAlpha.300" : "transparent"
        }
        zIndex={2}
        willChange="transform"
      >
        <Box
          as="iframe"
          ref={agentChatFrameRef}
          src="/standalone/agent-chat"
          border="none"
          w="100%"
          h="100%"
          onLoad={() => {
            notifyAgentChatTextVisibility(isAgentChatOpen);
          }}
        />
      </Flex>

      {isLaunchPage ? (
        <>
          <Flex
            flex={1}
            minW={0}
            position="relative"
            ml={launchContentOffset}
            transition="margin-left 0.35s ease"
          >
            {!isAgentChatOpen && (
              <AgentHostess onToggleAgentChat={openAgentChatPanel} />
            )}
            {children}
          </Flex>
        </>
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

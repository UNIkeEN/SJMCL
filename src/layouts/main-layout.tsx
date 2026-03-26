import {
  Center,
  Flex,
  Icon,
  useColorMode,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { LuGripVertical } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import AgentChatPage from "@/components/agent-chat";
import AgentHostess from "@/components/agent-hostess";
import AdvancedCard from "@/components/common/advanced-card";
import DevToolbar from "@/components/dev/dev-toolbar";
import MainWindowTitlebar from "@/components/main-window-titlebar";
import StarUsModal from "@/components/modals/star-us-modal";
import WelcomeAndTermsModal from "@/components/modals/welcome-and-terms-modal";
import { useLauncherConfig } from "@/contexts/config";
import { isDev } from "@/utils/env";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const router = useRouter();
  const { config, update } = useLauncherConfig();
  const { colorMode } = useColorMode();
  const isDarkenBg =
    colorMode === "dark" && config.appearance.background.autoDarken;

  const [bgImgSrc, setBgImgSrc] = useState<string>("");
  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(300);
  const [isDragging, setIsDragging] = useState(false);
  const isCheckedRunCount = useRef(false);
  const isStandAlone = router.pathname.startsWith("/standalone");
  const isLaunchPage = router.pathname === "/launch";

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      let newWidth = e.clientX;
      if (newWidth < 250) newWidth = 250;
      if (newWidth > window.innerWidth - 450)
        newWidth = window.innerWidth - 450;
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = "default";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
  };

  const agentChatPanelWidth = `${panelWidth}px`;
  const agentChatPanelTransform = isAgentChatOpen
    ? "translateX(0)"
    : "translateX(-100%)";
  const agentChatPanelOffset = isAgentChatOpen ? agentChatPanelWidth : "0px";

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
  const resizeHoverBg = useColorModeValue("blackAlpha.600", "whiteAlpha.600");
  const resizeHoverIconColor = useColorModeValue(
    "whiteAlpha.800",
    "blackAlpha.800"
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
      w="100vw"
      overflow="hidden"
      bgImg={`url('${bgImgSrc}')`}
      bgSize="cover"
      bgPosition="center"
      bgRepeat="no-repeat"
      bgColor={isDarkenBg ? "rgba(0,0,0,0.45)" : "transparent"}
      bgBlendMode={isDarkenBg ? "darken" : "normal"}
      style={getGlobalExtraStyle(config)}
    >
      <MainWindowTitlebar />
      <Flex w="full" flex={1} minH={0} flexDir="row" justify="space-between">
        <Flex
          w={agentChatPanelOffset}
          overflow="hidden"
          transform={agentChatPanelTransform}
          transition="transform 0.35s ease"
          p={isAgentChatOpen ? 2 : 0}
          position="relative"
        >
          {isAgentChatOpen && (
            <>
              <AgentChatPage
                onAgentChatPanelClose={() => setIsAgentChatOpen(false)}
              />
              <Flex
                role="group"
                position="absolute"
                top={0}
                right={0}
                w={2}
                h="100%"
                borderRadius="full"
                cursor="col-resize"
                onMouseDown={startResize}
                zIndex={10}
                transition="background 0.2s"
                bgColor={isDragging ? resizeHoverBg : "transparent"}
                _hover={{ bgColor: resizeHoverBg }}
                alignItems="center"
                justifyContent="center"
              >
                <Icon
                  as={LuGripVertical}
                  opacity={isDragging ? 1 : 0}
                  color={resizeHoverIconColor}
                  _groupHover={{ opacity: 1 }}
                  transition="opacity 0.2s"
                />
              </Flex>
            </>
          )}
        </Flex>

        <Flex flex={1} p={2} pl={isAgentChatOpen ? 0 : 2} h="full" minH={0}>
          {isLaunchPage ? (
            children
          ) : (
            <AdvancedCard
              w="full"
              h="full"
              level="back"
              overflow="auto"
              borderRadius="2xl"
            >
              {children}
            </AdvancedCard>
          )}
        </Flex>
      </Flex>
      {isLaunchPage && !isAgentChatOpen && (
        <AgentHostess onToggleAgentChat={() => setIsAgentChatOpen(true)} />
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

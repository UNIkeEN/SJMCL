import {
  Center,
  Flex,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { BeatLoader } from "react-spinners";
import AdvancedCard from "@/components/common/advanced-card";
import { DownloadFloatButton } from "@/components/download-float-button";
import HeadNavBar from "@/components/head-navbar";
import StarUsModal from "@/components/modals/star-us-modal";
import WelcomeAndTermsModal from "@/components/modals/welcome-and-terms-modal";
import { useLauncherConfig } from "@/contexts/config";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const router = useRouter();
  const { config, update } = useLauncherConfig();

  const [bgImgSrc, setBgImgSrc] = useState<string>("");
  const isCheckedRunCount = useRef(false);
  const isStandAlone = router.pathname.startsWith("/standalone");

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
          convertFileSrc(`${_appDataDir}/UserContent/Backgrounds/${bgKey}`)
        );
      }
    };

    constructBgImgSrc();
  }, [config.appearance.background.choice]);

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
      </div>
    );
  }

  if (config.mocked)
    return (
      <Center h="100%" style={getGlobalExtraStyle(config)}>
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
      style={getGlobalExtraStyle(config)}
    >
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

      <DownloadFloatButton />

      <WelcomeAndTermsModal
        isOpen={isWelcomeAndTermsModalOpen}
        onClose={onWelcomeAndTermsModalClose}
      />
      <StarUsModal isOpen={isStarUsModalOpen} onClose={onStarUsModalClose} />
    </Flex>
  );
};

export default MainLayout;

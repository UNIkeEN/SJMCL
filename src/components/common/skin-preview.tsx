import {
  Box,
  BoxProps,
  Flex,
  HStack,
  IconButton,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BsPersonRaisedHand } from "react-icons/bs";
import {
  FaCircleCheck,
  FaPerson,
  FaPersonRunning,
  FaPersonWalking,
  FaRegCircle,
} from "react-icons/fa6";
import {
  LuChevronUp,
  LuPause,
  LuPlay,
  LuRefreshCw,
  LuRefreshCwOff,
} from "react-icons/lu";
import * as skinview3d from "skinview3d";
import { useLauncherConfig } from "@/contexts/config";

type AnimationType = "idle" | "walk" | "run" | "wave";
type backgroundType = "none" | "black" | "panorama";

interface SkinPreviewProps extends Omit<BoxProps, "width" | "height"> {
  skinSrc?: string;
  capeSrc?: string;
  width?: number;
  height?: number;
  animation?: AnimationType;
  canvasBg?: backgroundType;
  showCape?: boolean;
  showControlBar?: boolean;
}

const SkinPreview: React.FC<SkinPreviewProps> = ({
  skinSrc = "/images/skins/unicorn_isla.png",
  capeSrc,
  width = 300,
  height = 400,
  animation = "walk",
  canvasBg = "none",
  showCape = true,
  showControlBar = true,
  ...props
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [skinViewer, setSkinViewer] = useState<skinview3d.SkinViewer | null>(
    null
  );
  const [currentAnimation, setCurrentAnimation] =
    useState<AnimationType>(animation);
  const [background, setBackground] = useState<backgroundType>(canvasBg);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isCapeVisible, setIsCapeVisible] = useState(showCape);

  useEffect(() => {
    setIsCapeVisible(showCape);
  }, [showCape]);

  useEffect(() => {
    if (skinViewer) {
      skinViewer.loadSkin(skinSrc);
      if (isCapeVisible && capeSrc) {
        skinViewer.loadCape(capeSrc);
      } else {
        skinViewer.loadCape(null);
      }
    }
  }, [skinViewer, skinSrc, capeSrc, isCapeVisible]);

  // animation
  const animationList = useMemo(
    () => ({
      idle: { icon: <FaPerson />, animation: new skinview3d.IdleAnimation() },
      walk: {
        icon: <FaPersonWalking />,
        animation: new skinview3d.WalkingAnimation(),
      },
      run: {
        icon: <FaPersonRunning />,
        animation: new skinview3d.RunningAnimation(),
      },
      wave: {
        icon: <BsPersonRaisedHand />,
        animation: new skinview3d.WaveAnimation(),
      },
    }),
    []
  );

  const animationTypes = Object.keys(animationList) as AnimationType[];

  useEffect(() => {
    // create once
    if (canvasRef.current && !skinViewer) {
      const viewer = new skinview3d.SkinViewer({
        canvas: canvasRef.current,
        width: width,
        height: height - 40, // Subtract height for control bar and top-margin
      });

      viewer.zoom = 0.8;
      viewer.controls.enableZoom = false;

      setSkinViewer(viewer);
    }
  }, [width, height, showControlBar, skinViewer, animationList.walk.animation]);

  useEffect(() => {
    if (skinViewer) {
      skinViewer.autoRotate = isPlaying && autoRotate;
      if (isPlaying) {
        skinViewer.animation = animationList[currentAnimation].animation;
      } else {
        skinViewer.animation = null;
        setAutoRotate(false);
      }
    }
  }, [skinViewer, autoRotate, currentAnimation, isPlaying, animationList]);

  // background
  const backgroundList = useMemo(
    () => ({
      none: {
        colorScheme: "black",
        btnVariant: "outline",
        operation: () => {
          if (skinViewer) skinViewer.background = null;
        },
      },
      black: {
        colorScheme: "gray",
        btnVariant: "solid",
        operation: () => {
          if (skinViewer) skinViewer.background = "#2D3748";
        },
      },
      panorama: {
        bg: "/images/skins/panorama.jpg",
        colorScheme: "blackAlpha",
        btnVariant: "solid",
        operation: () => {
          if (skinViewer) skinViewer.loadPanorama("/images/skins/panorama.jpg");
        },
      },
    }),
    [skinViewer]
  );

  const backgroundTypes = Object.keys(backgroundList) as backgroundType[];

  const BackGroundSelector = () => {
    return (
      <Popover placement="top-start">
        <PopoverTrigger>
          <IconButton
            size="xs"
            colorScheme={backgroundList[background].colorScheme}
            variant={backgroundList[background].btnVariant}
            mr={1}
            aria-label="color"
            icon={<LuChevronUp />}
            style={
              background === "panorama"
                ? {
                    backgroundImage: `url(${backgroundList["panorama"].bg})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {}
            }
          />
        </PopoverTrigger>
        <PopoverContent width="auto" maxWidth="none">
          <PopoverBody>
            <HStack>
              {backgroundTypes.map((type) => (
                <IconButton
                  key={type}
                  size="xs"
                  colorScheme={backgroundList[type].colorScheme}
                  variant={backgroundList[type].btnVariant}
                  aria-label="color"
                  icon={
                    type === background ? <FaCircleCheck /> : <FaRegCircle />
                  }
                  style={
                    type === "panorama"
                      ? {
                          backgroundImage: `url(${backgroundList["panorama"].bg})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : {}
                  }
                  onClick={() => {
                    setBackground(type);
                    backgroundList[type].operation();
                  }}
                />
              ))}
            </HStack>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    );
  };

  useEffect(() => {
    backgroundList[background].operation();
  }, [background, backgroundList]);

  return (
    <Box {...props}>
      <canvas ref={canvasRef} />
      {showControlBar && (
        <Flex alignItems="center" justifyContent="space-between" mt={2}>
          <HStack spacing={0}>
            <BackGroundSelector />
            <Tooltip label={t(`SkinPreview.animation.${currentAnimation}`)}>
              <IconButton
                aria-label="Switch Animation"
                icon={animationList[currentAnimation].icon}
                variant="ghost"
                onClick={() => {
                  const currentIndex = animationTypes.indexOf(currentAnimation);
                  const nextIndex = (currentIndex + 1) % animationTypes.length;
                  setCurrentAnimation(animationTypes[nextIndex]);
                }}
              />
            </Tooltip>
            <Tooltip
              label={t(
                `SkinPreview.button.${autoRotate ? "disable" : "enable"}Rotation`
              )}
            >
              <IconButton
                aria-label="Toggle Rotation"
                icon={autoRotate ? <LuRefreshCw /> : <LuRefreshCwOff />}
                variant="ghost"
                onClick={() => setAutoRotate(!autoRotate)}
              />
            </Tooltip>
            <Tooltip
              label={t(`SkinPreview.button.${isPlaying ? "pause" : "play"}`)}
            >
              <IconButton
                aria-label="Play/Pause Animation"
                icon={isPlaying ? <LuPause /> : <LuPlay />}
                variant="ghost"
                onClick={() => {
                  setIsPlaying(!isPlaying);
                  if (isPlaying) {
                    setAutoRotate(false);
                  }
                }}
              />
            </Tooltip>
          </HStack>
          <HStack>
            <Text fontSize="sm">{t("SkinPreview.cape")}</Text>
            <Switch
              isChecked={isCapeVisible}
              onChange={(e) => setIsCapeVisible(e.target.checked)}
              colorScheme={primaryColor}
            />
          </HStack>
        </Flex>
      )}
    </Box>
  );
};

export default SkinPreview;

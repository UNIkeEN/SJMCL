import {
  BoxProps,
  Flex,
  HStack,
  Icon,
  IconButton,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  LuCircleX,
  LuPause,
  LuPlay,
  LuRefreshCw,
  LuRefreshCwOff,
} from "react-icons/lu";
import * as skinview3d from "skinview3d";
import { useLauncherConfig } from "@/contexts/config";
import { SkinModel } from "@/enums/account";

type AnimationType = "idle" | "walk" | "run" | "wave";
type backgroundType = "none" | "black" | "panorama";

interface SkinPreviewProps extends Omit<BoxProps, "width" | "height"> {
  skinSrc?: string;
  capeSrc?: string;
  width?: number;
  height?: number;
  animation?: AnimationType;
  canvasBg?: backgroundType;
  isCapeVisible?: boolean;
  onCapeVisibilityChange?: (show: boolean) => void;
  errorMessage?: string | null;
  onSkinError?: (msg: string | null) => void;
  showControlBar?: boolean;
  skinModel?: SkinModel;
}

const SkinPreview: React.FC<SkinPreviewProps> = ({
  skinSrc,
  capeSrc,
  width = 300,
  height = 400,
  animation = "walk",
  canvasBg = "none",
  isCapeVisible = true,
  onCapeVisibilityChange,
  errorMessage,
  onSkinError,
  showControlBar = true,
  skinModel,
  ...props
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const skinViewerRef = useRef<skinview3d.SkinViewer | null>(null);
  const [currentAnimation, setCurrentAnimation] =
    useState<AnimationType>(animation);
  const [background, setBackground] = useState<backgroundType>(canvasBg);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);

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

  const initSkinViewer = useCallback(() => {
    if (!canvasRef.current) return;
    if (skinViewerRef.current) skinViewerRef.current.dispose();
    skinViewerRef.current = new skinview3d.SkinViewer({
      canvas: canvasRef.current,
      width: width,
      height: height - 40, // Subtract height for control bar and top-margin
    });

    skinViewerRef.current.zoom = 0.8;
    skinViewerRef.current.controls.enableZoom = false;
    skinViewerRef.current.autoRotate = isPlaying && autoRotate;
    if (isPlaying) {
      skinViewerRef.current.animation =
        animationList[currentAnimation].animation;
    } else {
      skinViewerRef.current.animation = null;
      setAutoRotate(false);
    }
  }, [width, height, isPlaying, autoRotate, animationList, currentAnimation]);

  useEffect(() => {
    initSkinViewer();
  }, [initSkinViewer]);

  useEffect(() => {
    onCapeVisibilityChange?.(isCapeVisible);
  }, [onCapeVisibilityChange, isCapeVisible]);

  useEffect(() => {
    (async () => {
      try {
        if (skinViewerRef.current && skinSrc) {
          await skinViewerRef.current.loadSkin(skinSrc, {
            model: skinModel
              ? skinModel === SkinModel.Slim
                ? "slim"
                : "default"
              : "auto-detect",
          });
          if (isCapeVisible && capeSrc) {
            await skinViewerRef.current.loadCape(capeSrc);
          } else {
            skinViewerRef.current.resetCape();
          }
          onSkinError?.(null);
        }
      } catch (error) {
        initSkinViewer(); // reset viewer on error
        let errorMsg =
          error instanceof Error
            ? error.message
            : t("SkinPreview.error.loadSkin");
        onSkinError?.(errorMsg);
        logger.error(`SkinPreview error: ${errorMsg}`);
      }
    })();
  }, [
    skinViewerRef,
    skinSrc,
    capeSrc,
    isCapeVisible,
    t,
    initSkinViewer,
    skinModel,
    onSkinError,
  ]);

  // background
  const backgroundList = useMemo(
    () => ({
      none: {
        colorScheme: "black",
        btnVariant: "outline",
        operation: () => {
          if (skinViewerRef.current) skinViewerRef.current.background = null;
        },
      },
      black: {
        colorScheme: "gray",
        btnVariant: "solid",
        operation: () => {
          if (skinViewerRef.current)
            skinViewerRef.current.background = "#2D3748";
        },
      },
      panorama: {
        bg: "/images/skins/panorama.jpg",
        colorScheme: "blackAlpha",
        btnVariant: "solid",
        operation: () => {
          if (skinViewerRef.current)
            skinViewerRef.current.loadPanorama("/images/skins/panorama.jpg");
        },
      },
    }),
    [skinViewerRef]
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
    <VStack {...props} width={width} height={height}>
      {errorMessage && (
        <VStack
          width={width}
          height={height - 40}
          justifyContent="center"
          spacing={4}
        >
          <Icon as={LuCircleX} boxSize={12} color="red.500" />
          <Text className="secondary-text">{errorMessage}</Text>
        </VStack>
      )}
      <canvas
        ref={canvasRef}
        style={{ display: errorMessage ? "none" : undefined }}
      />
      {showControlBar && (
        <Flex
          alignItems="center"
          justifyContent="space-between"
          mt={2}
          width="100%"
        >
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
              onChange={(e) => onCapeVisibilityChange?.(e.target.checked)}
              colorScheme={primaryColor}
            />
          </HStack>
        </Flex>
      )}
    </VStack>
  );
};

export default SkinPreview;

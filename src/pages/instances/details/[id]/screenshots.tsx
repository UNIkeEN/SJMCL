import {
  Box,
  Center,
  IconButton,
  Image,
  Skeleton,
  Tooltip,
  useDisclosure,
} from "@chakra-ui/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import router from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEllipsis } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import Empty from "@/components/common/empty";
import { Section } from "@/components/common/section";
import {
  VirtualWrapCardGroup,
  WrapCardProps,
} from "@/components/common/wrap-card-virtual";
import PreviewScreenshotModal from "@/components/modals/preview-screenshot-modal";
import { useInstanceSharedData } from "@/contexts/instance";
import { GetStateFlag } from "@/hooks/get-state";
import { ScreenshotInfo } from "@/models/instance/misc";

const ASPECT_RATIO = 16 / 9;

const InstanceScreenshotsPage: React.FC = () => {
  const { getScreenshotList, isScreenshotListLoading: isLoading } =
    useInstanceSharedData();
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>([]);
  const [currentScreenshot, setCurrentScreenshot] =
    useState<ScreenshotInfo | null>(null);

  const getScreenshotListWrapper = useCallback(
    (sync?: boolean) => {
      getScreenshotList(sync)
        .then((data) => {
          if (data === GetStateFlag.Cancelled) return;
          setScreenshots(data || []);
        })
        .catch(() => setScreenshots([]));
    },
    [getScreenshotList]
  );

  useEffect(() => {
    getScreenshotListWrapper();
  }, [getScreenshotListWrapper]);

  const {
    isOpen: isScreenshotPreviewModalOpen,
    onOpen: onScreenshotPreviewModalOpen,
    onClose: onScreenshotPreviewModalClose,
  } = useDisclosure();

  useEffect(() => {
    const { screenshotIndex } = router.query;
    if (screenshotIndex) {
      setCurrentScreenshot(screenshots[Number(screenshotIndex)]);
      onScreenshotPreviewModalOpen();
    }
  }, [screenshots, onScreenshotPreviewModalOpen]);

  const handleCloseModal = useCallback(() => {
    onScreenshotPreviewModalClose();
    const { id } = router.query;
    if (id !== undefined) {
      const instanceId = Array.isArray(id) ? id[0] : id;
      router.replace(
        {
          pathname: `/instances/details/${encodeURIComponent(instanceId)}/screenshots`,
          query: {},
        },
        undefined,
        { shallow: true }
      );
    }
  }, [onScreenshotPreviewModalClose]);

  const wrapCardItems: WrapCardProps[] = screenshots.map((screenshot) => ({
    cardContent: (
      <ScreenshotCell
        screenshot={screenshot}
        onPreview={() => {
          setCurrentScreenshot(screenshot);
          onScreenshotPreviewModalOpen();
        }}
      />
    ),
    colSpan: 1,
  }));

  return (
    <Section overflow="hidden">
      {isLoading ? (
        <Center mt={4}>
          <BeatLoader size={16} color="gray" />
        </Center>
      ) : screenshots.length > 0 ? (
        <VirtualWrapCardGroup
          items={wrapCardItems}
          cardAspectRatio={ASPECT_RATIO}
          h="calc(100vh - 180px)"
        />
      ) : (
        <Empty withIcon={false} size="sm" />
      )}
      {currentScreenshot && (
        <PreviewScreenshotModal
          screenshot={currentScreenshot}
          isOpen={isScreenshotPreviewModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </Section>
  );
};

const ScreenshotCell = ({
  screenshot,
  onPreview,
}: {
  screenshot: ScreenshotInfo;
  onPreview: () => void;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const { t } = useTranslation();

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      w="100%"
      h="100%"
      position="relative"
      borderRadius="md"
      overflow="hidden"
    >
      {!isLoaded && (
        <Skeleton
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          startColor="gray.700"
          endColor="gray.600"
          speed={1}
        />
      )}
      <Image
        src={convertFileSrc(screenshot.filePath)}
        alt={screenshot.fileName}
        objectFit="cover"
        w="100%"
        h="100%"
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        style={{
          opacity: isLoaded ? 1 : 0,
          transition: "opacity 0.2s ease-in-out",
        }}
      />
      {isHovered && isLoaded && (
        <Box position="absolute" top={1} right={1}>
          <Tooltip
            label={t("InstanceScreenshotsPage.button.details")}
            placement="auto"
          >
            <IconButton
              icon={<LuEllipsis />}
              aria-label="details"
              colorScheme="blackAlpha"
              variant="solid"
              size="sm"
              onClick={onPreview}
            />
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

export default InstanceScreenshotsPage;

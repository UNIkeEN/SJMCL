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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEllipsis } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { AutoSizer, Grid, GridCellProps } from "react-virtualized";
import "react-virtualized/styles.css";
import Empty from "@/components/common/empty";
import { Section } from "@/components/common/section";
import PreviewScreenshotModal from "@/components/modals/preview-screenshot-modal";
import { useInstanceSharedData } from "@/contexts/instance";
import { GetStateFlag } from "@/hooks/get-state";
import { ScreenshotInfo } from "@/models/instance/misc";

const GAP = 12;
const ASPECT_RATIO = 9 / 16;
const OVERSCAN_ROW_COUNT = 5;
const MIN_ITEM_WIDTH = 220;

const getColumnCount = (containerWidth: number): number => {
  if (containerWidth <= 0) return 5;
  const columnCount = Math.floor(containerWidth / MIN_ITEM_WIDTH);
  return Math.max(2, Math.min(5, columnCount));
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

const InstanceScreenshotsPage: React.FC = () => {
  const { getScreenshotList, isScreenshotListLoading: isLoading } =
    useInstanceSharedData();
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>([]);
  const [currentScreenshot, setCurrentScreenshot] =
    useState<ScreenshotInfo | null>(null);

  const gridRef = useRef<Grid>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

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

  // Handle container resize with debounce to avoid excessive re-renders
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const newWidth = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(newWidth);

      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        gridRef.current?.recomputeGridSize();
      }, 100);
    });

    observer.observe(containerRef.current);
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      observer.disconnect();
    };
  }, []);

  const {
    isOpen: isScreenshotPreviewModalOpen,
    onOpen: onScreenshotPreviewModalOpen,
    onClose: onScreenshotPreviewModalClose,
  } = useDisclosure();

  // Open preview modal when screenshot index is in URL query
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

  // Track scrolling state for performance optimization
  const handleScroll = useCallback(({ scrollTop }: { scrollTop: number }) => {
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, []);

  const gridConfig = useMemo(() => {
    const columnCount = getColumnCount(containerWidth);
    return {
      columnCount,
      rowCount: Math.ceil(screenshots.length / columnCount),
    };
  }, [containerWidth, screenshots.length]);

  const cellRenderer = useCallback(
    ({ columnIndex, rowIndex, key, style }: GridCellProps) => {
      const index = rowIndex * gridConfig.columnCount + columnIndex;

      if (index >= screenshots.length) {
        return null;
      }

      const screenshot = screenshots[index];

      return (
        <div
          key={key}
          style={{
            ...style,
            padding: GAP / 2,
          }}
        >
          <ScreenshotCell
            screenshot={screenshot}
            onPreview={() => {
              setCurrentScreenshot(screenshot);
              onScreenshotPreviewModalOpen();
            }}
          />
        </div>
      );
    },
    [screenshots, gridConfig.columnCount, onScreenshotPreviewModalOpen]
  );

  return (
    <Section overflow="hidden">
      <Box ref={containerRef} w="100%" h="100%" overflow="hidden">
        {isLoading ? (
          <Center mt={4}>
            <BeatLoader size={16} color="gray" />
          </Center>
        ) : screenshots.length > 0 ? (
          <Box
            h="calc(100vh - 180px)"
            minH="400px"
            overflow="hidden"
            className="no-scrollbar"
          >
            <AutoSizer>
              {({ width, height }) => {
                if (width === 0 || height === 0) return null;

                const columnWidth = width / gridConfig.columnCount;
                const rowHeight = columnWidth * ASPECT_RATIO;

                return (
                  <Grid
                    ref={gridRef}
                    width={width}
                    height={height}
                    columnCount={gridConfig.columnCount}
                    columnWidth={columnWidth}
                    rowCount={gridConfig.rowCount}
                    rowHeight={rowHeight}
                    cellRenderer={cellRenderer}
                    overscanRowCount={OVERSCAN_ROW_COUNT}
                    onScroll={handleScroll}
                    scrolling={isScrolling}
                    style={{ overflowX: "hidden" }}
                  />
                );
              }}
            </AutoSizer>
          </Box>
        ) : (
          <Empty withIcon={false} size="sm" />
        )}
      </Box>
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

export default InstanceScreenshotsPage;

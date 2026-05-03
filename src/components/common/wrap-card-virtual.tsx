import { Box, Card, Center } from "@chakra-ui/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BeatLoader } from "react-spinners";
import {
  AutoSizer,
  Grid,
  GridCellProps,
  ScrollEventData,
} from "react-virtualized";
import { Section, SectionProps } from "@/components/common/section";
import { WrapCard, WrapCardProps } from "@/components/common/wrap-card";
import cardStyles from "@/styles/card.module.css";

export { WrapCard };
export type { WrapCardProps };

export interface VirtualWrapCardGroupProps extends SectionProps {
  items: (WrapCardProps | React.ReactNode)[];
  cardMinWidth?: number;
  spacing?: number;
  cardAspectRatio?: number;
  useInfiniteScroll?: boolean;
  hasMore?: boolean;
  loadMore?: () => void;
}

export const VirtualWrapCardGroup: React.FC<VirtualWrapCardGroupProps> = ({
  items,
  cardMinWidth = 41.8,
  spacing = 12,
  cardAspectRatio = 0,
  useInfiniteScroll = false,
  hasMore = false,
  loadMore = () => {},
  ...props
}) => {
  const gridRef = useRef<Grid>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (items.length > 0) {
      setCanLoadMore(true);
    }
  }, [items.length]);

  useEffect(() => {
    setLoadingMore(false);
  }, [items]);

  const debouncedLoadMore = useCallback(() => {
    if (canLoadMore && hasMore && !loadingMore) {
      setLoadingMore(true);
      loadMore();
    }
  }, [canLoadMore, hasMore, loadingMore, loadMore]);

  const handleScroll = useCallback(
    ({ clientHeight, scrollHeight, scrollTop }: ScrollEventData) => {
      if (useInfiniteScroll && scrollTop + clientHeight >= scrollHeight - 300) {
        debouncedLoadMore();
      }
      setIsScrolling(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    },
    [debouncedLoadMore, useInfiniteScroll]
  );

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

  const getColumnCount = useCallback(
    (width: number): number => {
      if (width <= 0) return 5;
      const columnCount = Math.floor(width / (cardMinWidth * 4 + spacing));
      return Math.max(2, Math.min(5, columnCount));
    },
    [cardMinWidth, spacing]
  );

  const gridConfig = useMemo(() => {
    const columnCount = getColumnCount(containerWidth);
    return {
      columnCount,
      rowCount: Math.ceil(items.length / columnCount),
    };
  }, [containerWidth, items.length, getColumnCount]);

  const isWrapCardProps = (item: any): item is WrapCardProps => {
    return (
      (item as WrapCardProps)?.cardContent != null ||
      (item as WrapCardProps)?.children != null
    );
  };

  const cellRenderer = useCallback(
    ({ columnIndex, rowIndex, key, style }: GridCellProps) => {
      const index = rowIndex * gridConfig.columnCount + columnIndex;

      if (index >= items.length) {
        return null;
      }

      const item = items[index];

      if (isWrapCardProps(item)) {
        const validColSpan = Math.max(1, Math.floor(item.colSpan || 1));
        const columnWidth = containerWidth / gridConfig.columnCount;
        const cellWidth = columnWidth * validColSpan;

        return (
          <div
            key={key}
            style={{
              ...style,
              width: cellWidth,
              padding: `0 ${spacing / 2}px`,
              boxSizing: "border-box",
            }}
          >
            <WrapCard {...item} p={0} />
          </div>
        );
      }

      return null;
    },
    [items, gridConfig.columnCount, containerWidth, spacing]
  );

  const rowHeight = useMemo(() => {
    if (cardAspectRatio !== 0 && containerWidth > 0) {
      const columnWidth = containerWidth / gridConfig.columnCount;
      return columnWidth / cardAspectRatio;
    }
    return 150;
  }, [cardAspectRatio, containerWidth, gridConfig.columnCount]);

  return (
    <Section {...props}>
      {items.length > 0 && (
        <Card className={cardStyles["card-front"]} h="100%">
          <Box ref={containerRef} w="100%" h="100%" overflow="hidden">
            <AutoSizer>
              {({ width, height }) => {
                if (width === 0 || height === 0) return null;

                return (
                  <Grid
                    ref={gridRef}
                    width={width}
                    height={height}
                    columnCount={gridConfig.columnCount}
                    columnWidth={width / gridConfig.columnCount}
                    rowCount={gridConfig.rowCount}
                    rowHeight={rowHeight}
                    cellRenderer={cellRenderer}
                    overscanRowCount={5}
                    onScroll={handleScroll}
                    scrolling={isScrolling}
                    style={{ overflowX: "hidden" }}
                  />
                );
              }}
            </AutoSizer>
          </Box>
          {loadingMore && (
            <Center key="loading" mt="auto">
              <BeatLoader size={12} color="gray" />
            </Center>
          )}
        </Card>
      )}
    </Section>
  );
};

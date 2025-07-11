import { Button, Center, HStack, Text } from "@chakra-ui/react";
import { useMasonry, usePositioner, useResizeObserver } from "masonic";
import { useScroller, useSize } from "mini-virtual-list";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import React from "react";
import { useTranslation } from "react-i18next";
import { LuNewspaper, LuRefreshCcw } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import Empty from "@/components/common/empty";
import { Section } from "@/components/common/section";
import PosterCard from "@/components/poster-card";
import { useLauncherConfig } from "@/contexts/config";
import { PostSummary } from "@/models/post";
import { DiscoverService } from "@/services/discover";

export const DiscoverPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [visiblePosts, setVisiblePosts] = useState<PostSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [masonryKey, setMasonryKey] = useState(0);
  const hasMore = nextCursor !== null;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const containerRef = React.useRef(null);
  const { width = 734, height = 1332 } = useSize(containerRef) || {};
  const { scrollTop, isScrolling } = useScroller(containerRef);
  const positioner = usePositioner(
    {
      width: width > 0 ? width : 734,
      columnWidth: 200,
      columnGutter: 14,
    },
    [width, masonryKey]
  );

  const resizeObserver = useResizeObserver(positioner);

  const fetchFirstPage = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await DiscoverService.fetchPostSummaries(undefined);
      if (response.status === "success") {
        const posts: PostSummary[] = response.data.posts;
        const next: number | null = response.data.next ?? null;
        setVisiblePosts(posts);
        setNextCursor(next);
        setMasonryKey((k) => k + 1);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoading || nextCursor === null) return;
    setIsLoading(true);
    try {
      const response = await DiscoverService.fetchPostSummaries(nextCursor);
      console.log(visiblePosts);
      if (response.status === "success") {
        const posts: PostSummary[] = response.data.posts;
        const next: number | null = response.data.next ?? null;
        console.log(response.data);
        setVisiblePosts((prev) => [...prev, ...posts]);
        setNextCursor(next);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, nextCursor, visiblePosts]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && nextCursor !== null) {
          loadMore();
        }
      },
      { threshold: 1.0 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMore, isLoading, nextCursor]);

  useEffect(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  const masonry = useMasonry({
    positioner,
    resizeObserver,
    items: visiblePosts,
    height,
    scrollTop,
    isScrolling,
    overscanBy: 3,
    render: PosterCard,
  });
  return (
    <Section
      className="content-full-y"
      title={t("DiscoverPage.title")}
      headExtra={
        <HStack spacing={2}>
          <Button
            leftIcon={<LuNewspaper />}
            size="xs"
            colorScheme={primaryColor}
            variant={primaryColor === "gray" ? "subtle" : "outline"}
            onClick={() => router.push("/discover/sources")}
          >
            {t("DiscoverPage.button.sources")}
          </Button>
          <Button
            leftIcon={<LuRefreshCcw />}
            size="xs"
            colorScheme={primaryColor}
            onClick={fetchFirstPage}
          >
            {t("General.refresh")}
          </Button>
        </HStack>
      }
    >
      <div ref={containerRef}>
        {isLoading && visiblePosts.length === 0 ? (
          <Center mt={8}>
            <BeatLoader size={16} color="gray" />
          </Center>
        ) : visiblePosts.length === 0 ? (
          <Empty withIcon={false} size="sm" />
        ) : (
          <>
            {masonry}

            <Center mt={8} ref={loadMoreRef}>
              {isLoading && visiblePosts.length > 0 ? (
                <BeatLoader size={16} color="gray" />
              ) : !hasMore ? (
                <Text fontSize="xs" className="secondary-text">
                  {t("DiscoverPage.noMore")}
                </Text>
              ) : null}
            </Center>
          </>
        )}
      </div>
    </Section>
  );
};

export default DiscoverPage;

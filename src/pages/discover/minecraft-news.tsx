import { Center, HStack, Text } from "@chakra-ui/react";
import { Masonry } from "masonic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BeatLoader } from "react-spinners";
import { CommonIconButton } from "@/components/common/common-icon-button";
import Empty from "@/components/common/empty";
import { Section } from "@/components/common/section";
import PosterCard from "@/components/poster-card";
import { NewsPostRequest, NewsPostSummary } from "@/models/news-post";
import { DiscoverService } from "@/services/discover";

export const MC_NEWS_SOURCE_URL =
  "https://net-secondary.web.minecraft-services.net/api/v1.0";

export const MinecraftNewsPage = () => {
  const { t } = useTranslation();

  const [visiblePosts, setVisiblePosts] = useState<NewsPostSummary[]>([]);
  const [sourceCursors, setSourceCursors] = useState<
    Record<string, number | null>
  >({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [masonryKey, setMasonryKey] = useState<number>(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const mcSource: NewsPostRequest = useMemo(
    () => ({
      url: MC_NEWS_SOURCE_URL,
      cursor: null,
    }),
    []
  );

  const fetchPage = useCallback(
    async (
      requests: NewsPostRequest[]
    ): Promise<{
      posts: NewsPostSummary[];
      cursors: Record<string, number>;
    }> => {
      const response = await DiscoverService.fetchNewsPostSummaries(requests);
      if (response.status === "success") {
        return response.data;
      }

      return { posts: [], cursors: {} };
    },
    []
  );

  const fetchFirstPage = useCallback(async () => {
    setVisiblePosts([]);
    setIsLoading(true);
    try {
      const data = await fetchPage([{ ...mcSource, cursor: null }]);
      setVisiblePosts(data.posts);
      setSourceCursors(data.cursors ?? {});
      setMasonryKey((k) => k + 1);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, mcSource]);

  const loadMore = useCallback(async () => {
    if (isLoading) return;

    const cursor = sourceCursors[mcSource.url];
    if (cursor === null || cursor === undefined) return;

    setIsLoading(true);
    try {
      const data = await fetchPage([{ ...mcSource, cursor }]);
      setVisiblePosts((prev) => [...prev, ...data.posts]);
      setSourceCursors(data.cursors ?? {});
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, isLoading, mcSource, sourceCursors]);

  const hasMore =
    sourceCursors[mcSource.url] !== undefined &&
    sourceCursors[mcSource.url] !== null;

  const secMenu = [
    {
      icon: "refresh",
      onClick: fetchFirstPage,
    },
  ];

  useEffect(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          loadMore();
        }
      },
      { threshold: 1.0 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMore, isLoading]);

  return (
    <Section
      title={t("DiscoverLayout.discoverDomainList.minecraft-news")}
      headExtra={
        <HStack spacing={2}>
          {secMenu.map((btn, index) => (
            <CommonIconButton
              key={index}
              icon={btn.icon}
              onClick={btn.onClick}
              size="xs"
              fontSize="sm"
              h={21}
            />
          ))}
        </HStack>
      }
    >
      {isLoading && visiblePosts.length === 0 ? (
        <Center mt={8}>
          <BeatLoader size={16} color="gray" />
        </Center>
      ) : visiblePosts.length === 0 ? (
        <Empty withIcon={false} size="sm" />
      ) : (
        <>
          <Masonry
            key={masonryKey}
            items={visiblePosts}
            render={({ data }) => <PosterCard data={data} />}
            columnGutter={14}
            itemKey={(item) => item.link}
            overscanBy={1000}
          />

          <Center mt={8} ref={loadMoreRef} minH="32px">
            {isLoading && visiblePosts.length > 0 ? (
              <BeatLoader size={16} color="gray" />
            ) : !hasMore ? (
              <Text fontSize="xs" className="secondary-text">
                {t("DiscoverCommunityNewsPage.noMore")}
              </Text>
            ) : null}
          </Center>
        </>
      )}
    </Section>
  );
};

export default MinecraftNewsPage;

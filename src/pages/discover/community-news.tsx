import { Center, HStack, Text } from "@chakra-ui/react";
import { Masonry } from "masonic";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuNewspaper } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { CommonIconButton } from "@/components/common/common-icon-button";
import Empty from "@/components/common/empty";
import { Section } from "@/components/common/section";
import PosterCard from "@/components/poster-card";
import { useLauncherConfig } from "@/contexts/config";
import { NewsPostRequest, NewsPostSummary } from "@/models/news-post";
import { DiscoverService } from "@/services/discover";

export const CommunityNewsPage = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const router = useRouter();

  const [visiblePosts, setVisiblePosts] = useState<NewsPostSummary[]>([]);
  const [sourceCursors, setSourceCursors] = useState<
    Record<string, number | null>
  >({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [masonryKey, setMasonryKey] = useState<number>(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const fetchFirstPage = useCallback(async () => {
    setVisiblePosts([]);
    setIsLoading(true);
    try {
      const sources: NewsPostRequest[] = config.discoverSourceEndpoints
        .filter(([, enabled]) => enabled)
        .map(([url]) => ({
          url,
          cursor: null,
        }));

      const response = await DiscoverService.fetchNewsPostSummaries(sources);
      if (response.status === "success") {
        setVisiblePosts(response.data.posts);
        setSourceCursors(response.data.cursors ?? {});
        setMasonryKey((k) => k + 1);
      }
    } finally {
      setIsLoading(false);
    }
  }, [config.discoverSourceEndpoints]);

  const loadMore = useCallback(async () => {
    if (isLoading) return;

    const enabledUrls = new Set(
      config.discoverSourceEndpoints
        .filter(([, enabled]) => enabled)
        .map(([url]) => url)
    );

    const pendingSources: NewsPostRequest[] = Object.entries(sourceCursors)
      .filter(([url, cursor]) => cursor !== null && enabledUrls.has(url))
      .map(([url, cursor]) => ({ url, cursor }));

    if (pendingSources.length === 0) return;

    setIsLoading(true);
    try {
      const response =
        await DiscoverService.fetchNewsPostSummaries(pendingSources);
      if (response.status === "success") {
        setVisiblePosts((prev) => [...prev, ...response.data.posts]);
        setSourceCursors(response.data.cursors ?? {});
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, sourceCursors, config.discoverSourceEndpoints]);

  const hasMore = config.discoverSourceEndpoints.some(
    ([url, enabled]) =>
      enabled && sourceCursors[url] !== undefined && sourceCursors[url] !== null
  );

  const secMenu = [
    {
      icon: LuNewspaper,
      label: t("DiscoverCommunityNewsPage.sources"),
      onClick: () => {
        router.push("/discover/sources");
      },
    },
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
      title={t("DiscoverLayout.discoverDomainList.community-news")}
      headExtra={
        <HStack spacing={2}>
          {secMenu.map((btn, index) => (
            <CommonIconButton
              key={index}
              icon={btn.icon}
              label={btn.label}
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

export default CommunityNewsPage;

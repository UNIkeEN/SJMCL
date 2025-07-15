import { Button, Center, HStack, Text } from "@chakra-ui/react";
import { Masonry } from "masonic";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
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

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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
  }, [isLoading, nextCursor]);

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

  const hasMore = nextCursor !== null;
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
    </Section>
  );
};
export default DiscoverPage;

import {
  Avatar,
  Box,
  Card,
  Flex,
  Grid,
  HStack,
  Icon,
  IconButton,
  SimpleGrid,
  Skeleton,
  Tag,
  Text,
  VStack,
  useBreakpointValue,
  useColorModeValue,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuChevronLeft,
  LuChevronRight,
  LuDownload,
  LuRefreshCcw,
  LuSparkles,
} from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { OptionItem } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { OtherResourceSource, OtherResourceType } from "@/enums/resource";
import { NewsPostSummary } from "@/models/news-post";
import { OtherResourceInfo } from "@/models/resource";
import { DiscoverService } from "@/services/discover";
import { ResourceService } from "@/services/resource";
import { ISOToDate, formatRelativeTime } from "@/utils/datetime";
import { translateTag } from "@/utils/resource";
import { formatDisplayCount } from "@/utils/string";

type NewsCarouselProps = {
  title: string;
  posts: NewsPostSummary[];
  loading: boolean;
  onRefresh: () => void;
  accentColor: string;
};

const NewsCard = ({ post }: { post: NewsPostSummary | null }) => {
  const surface = useColorModeValue("chakra-body-bg", "blackAlpha.300");
  const stroke = useColorModeValue("gray.200", "whiteAlpha.200");
  const bannerHeight = useBreakpointValue(
    { base: "32", lg: "48" },
    {
      fallback: "base",
    }
  );
  const banner =
    post?.imageSrc && Array.isArray(post.imageSrc)
      ? post.imageSrc[0]
      : undefined;

  const { t } = useTranslation();

  return (
    <Card
      bg={surface}
      borderWidth="1px"
      borderColor={stroke}
      borderRadius="xl"
      overflow="hidden"
      h="full"
      display="flex"
      flexDirection="column"
      onClick={() => {
        openUrl(post?.link || "");
      }}
    >
      <HStack align="center" justify="space-between" p={2}>
        <HStack spacing={1.5} align="center">
          <Avatar
            size="xs"
            name={post?.source?.name}
            src={post?.source?.iconSrc}
          />
          <Text fontSize="sm">{post?.source?.name}</Text>
        </HStack>
        {post?.createAt && (
          <Text fontSize="xs" className="secondary-text">
            {formatRelativeTime(post.createAt, t).replace("on", "")}
          </Text>
        )}
      </HStack>
      {banner ? (
        <Box
          h={bannerHeight}
          position="relative"
          overflow="hidden"
          bgImage={`url(${banner})`}
          bgSize="cover"
          bgPos="center"
        />
      ) : (
        <Box
          h={bannerHeight}
          position="relative"
          overflow="hidden"
          bg="gray.500"
          opacity={0.2}
        />
      )}
      <Text fontSize="sm" noOfLines={2} m={2.5}>
        {post?.title}
      </Text>
    </Card>
  );
};

const NewsCarousel: React.FC<NewsCarouselProps> = ({
  title,
  posts,
  loading,
  onRefresh,
  accentColor,
}) => {
  const [page, setPage] = useState(0);
  const itemsPerPage =
    useBreakpointValue({ base: 1, md: 2, xl: 3 }, { fallback: "base" }) ?? 1;

  const slides = useMemo(() => {
    const baseItems = posts.length > 0 ? posts : [];
    const placeholders: Array<NewsPostSummary | null> = Array.from(
      { length: Math.max(itemsPerPage - baseItems.length, 0) },
      () => null
    );
    const padded = [...baseItems, ...placeholders];
    const groups: Array<Array<NewsPostSummary | null>> = [];
    const totalGroups = Math.max(1, Math.ceil(padded.length / itemsPerPage));

    for (let i = 0; i < totalGroups; i += 1) {
      const slice = padded.slice(i * itemsPerPage, (i + 1) * itemsPerPage);
      while (slice.length < itemsPerPage) slice.push(null);
      groups.push(slice);
    }

    return groups;
  }, [posts, itemsPerPage]);

  useEffect(() => {
    setPage(0);
  }, [posts, itemsPerPage]);

  const trackWidth = `${slides.length * 100}%`;
  const pageWidth = slides.length > 0 ? 100 / slides.length : 100;

  const canPrev = page > 0;
  const canNext = page < slides.length - 1;
  const showArrows = slides.length > 1;

  return (
    <Card
      p={4}
      borderRadius="xl"
      bg={useColorModeValue("chakra-body-bg", "blackAlpha.400")}
      borderWidth="1px"
      borderColor={useColorModeValue("gray.200", "whiteAlpha.200")}
      h="100%"
    >
      <Flex align="center" mb={4} gap={2}>
        <VStack align="start" spacing={0} flex={1}>
          <HStack spacing={2} align="center">
            <Icon as={LuSparkles} color={accentColor} />
            <Text fontSize="lg" fontWeight="bold">
              {title}
            </Text>
          </HStack>
        </VStack>
        <CommonIconButton
          icon={LuRefreshCcw}
          label="refresh"
          onClick={onRefresh}
          size="sm"
          fontSize="sm"
          isDisabled={loading}
        />
      </Flex>

      <Box position="relative">
        <Box overflow="hidden">
          <Flex
            w={trackWidth}
            transform={`translateX(-${page * pageWidth}%)`}
            transition="transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)"
            gap={4}
          >
            {slides.map((group, index) => (
              <Grid
                key={index}
                templateColumns={`repeat(${itemsPerPage}, minmax(0, 1fr))`}
                gap={4}
                w={`${pageWidth}%`}
              >
                {group.map((item, idx) => (
                  <Box
                    key={`${index}-${idx}`}
                    cursor={item?.link ? "pointer" : "default"}
                    onClick={() => {
                      if (item?.link) window.open(item.link, "_blank");
                    }}
                  >
                    <NewsCard post={item} />
                  </Box>
                ))}
              </Grid>
            ))}
          </Flex>
        </Box>

        {showArrows && (
          <>
            <IconButton
              aria-label="previous"
              icon={<LuChevronLeft />}
              size="sm"
              variant="ghost"
              position="absolute"
              top="50%"
              left={0}
              transform="translateY(-50%)"
              px={2}
              onClick={() => canPrev && setPage((p) => Math.max(0, p - 1))}
              isDisabled={!canPrev}
              zIndex={1}
            />
            <IconButton
              aria-label="next"
              icon={<LuChevronRight />}
              size="sm"
              variant="ghost"
              position="absolute"
              top="50%"
              right={0}
              transform="translateY(-50%)"
              px={2}
              onClick={() =>
                canNext && setPage((p) => Math.min(slides.length - 1, p + 1))
              }
              isDisabled={!canNext}
              zIndex={1}
            />
          </>
        )}
      </Box>
    </Card>
  );
};

const HotModpackGrid = ({
  items,
  loading,
  accentColor,
}: {
  items: OtherResourceInfo[];
  loading: boolean;
  accentColor: string;
}) => {
  const surface = useColorModeValue("chakra-body-bg", "blackAlpha.500");
  const stroke = useColorModeValue("gray.200", "whiteAlpha.200");

  const renderItem = (item?: OtherResourceInfo, index?: number) => (
    <Card
      key={item?.id || index}
      bg={surface}
      borderWidth="1px"
      borderColor={stroke}
      borderRadius="xl"
      boxShadow="sm"
      p={4}
    >
      <OptionItem
        prefixElement={
          <Skeleton isLoaded={!loading} borderRadius="md">
            <Avatar
              src={item?.iconSrc}
              name={item?.name}
              boxSize={12}
              borderRadius="md"
            />
          </Skeleton>
        }
        title={item?.name}
        titleExtra={
          item && (
            <Tag size="sm" colorScheme={accentColor} variant="subtle">
              {translateTag(
                item.tags.filter((tag) =>
                  translateTag(tag, item.type, item.source)
                )[0],
                item.type,
                item.source
              )}
            </Tag>
          )
        }
        description={
          <Skeleton isLoaded={!loading} borderRadius="md">
            <Text fontSize="xs" className="secondary-text" noOfLines={2}>
              {item?.description}
            </Text>
          </Skeleton>
        }
        titleLineWrap={false}
        isFullClickZone
        onClick={() => {
          if (item?.websiteUrl) window.open(item.websiteUrl, "_blank");
        }}
        maxDescriptionLines={2}
        isChildrenIndependent
      />
      <HStack spacing={3} align="center">
        <Skeleton isLoaded={!loading} borderRadius="md">
          <HStack spacing={1} fontSize="xs" className="secondary-text">
            <Icon as={LuDownload} />
            <Text>{formatDisplayCount(item?.downloads ?? 0)}</Text>
          </HStack>
        </Skeleton>
        <Skeleton isLoaded={!loading} borderRadius="md">
          <Text fontSize="xs" className="secondary-text">
            {item?.lastUpdated ? ISOToDate(item.lastUpdated) : ""}
          </Text>
        </Skeleton>
      </HStack>
    </Card>
  );

  const skeletons = Array.from({ length: 6 }, (_, i) =>
    renderItem(undefined, i)
  );

  return (
    <SimpleGrid columns={{ base: 1, lg: 2 }} gap={4} w="100%">
      {loading
        ? skeletons
        : items.map((item, index) => renderItem(item, index))}
    </SimpleGrid>
  );
};

export const HomePage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const accentColor = `var(--chakra-colors-${primaryColor}-400)`;

  const [communityPosts, setCommunityPosts] = useState<NewsPostSummary[]>([]);
  const [mcPosts, setMcPosts] = useState<NewsPostSummary[]>([]);
  const [cfModpacks, setCfModpacks] = useState<OtherResourceInfo[]>([]);
  const [mrModpacks, setMrModpacks] = useState<OtherResourceInfo[]>([]);
  const [isLoadingCommunity, setIsLoadingCommunity] = useState<boolean>(false);
  const [isLoadingMC, setIsLoadingMC] = useState<boolean>(false);
  const [isLoadingCfModpacks, setIsLoadingCfModpacks] =
    useState<boolean>(false);
  const [isLoadingMrModpacks, setIsLoadingMrModpacks] =
    useState<boolean>(false);

  const fetchCommunityNews = useCallback(async () => {
    setIsLoadingCommunity(true);
    try {
      const sources = config.discoverSourceEndpoints
        .filter(([, enabled]) => enabled)
        .map(([url]) => ({ url, cursor: null }));

      if (sources.length === 0) {
        setCommunityPosts([]);
        return;
      }

      const response = await DiscoverService.fetchNewsPostSummaries(sources);
      if (response.status === "success") {
        setCommunityPosts(response.data.posts.slice(0, 6));
      }
    } finally {
      setIsLoadingCommunity(false);
    }
  }, [config.discoverSourceEndpoints]);

  const fetchMinecraftNews = useCallback(async () => {
    setIsLoadingMC(true);
    // Placeholder: real Minecraft news feed to be wired later.
    setTimeout(() => {
      setMcPosts([]);
      setIsLoadingMC(false);
    }, 400);
  }, []);

  const fetchHotModpacks = useCallback(
    async (source: OtherResourceSource) => {
      source === OtherResourceSource.CurseForge
        ? setIsLoadingCfModpacks(true)
        : setIsLoadingMrModpacks(true);
      try {
        const response = await ResourceService.fetchResourceListByName(
          OtherResourceType.ModPack,
          "",
          "All",
          "All",
          source === OtherResourceSource.CurseForge
            ? "Popularity"
            : "relevance",
          source,
          0,
          6
        );
        if (response.status === "success") {
          source === OtherResourceSource.CurseForge
            ? setCfModpacks(response.data.list)
            : setMrModpacks(response.data.list);
        } else {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
      } finally {
        source === OtherResourceSource.CurseForge
          ? setIsLoadingCfModpacks(false)
          : setIsLoadingMrModpacks(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchCommunityNews();
    fetchMinecraftNews();
    fetchHotModpacks(OtherResourceSource.CurseForge);
    fetchHotModpacks(OtherResourceSource.Modrinth);
  }, [fetchCommunityNews, fetchMinecraftNews, fetchHotModpacks]);

  return (
    <Section title={t("DiscoverLayout.discoverDomainList.home")}>
      <VStack align="stretch" spacing={6} pb={4}>
        <VStack spacing={5} align="stretch">
          <NewsCarousel
            title={t("DiscoverHomePage.minecraft-news")}
            posts={mcPosts}
            loading={isLoadingMC}
            onRefresh={fetchMinecraftNews}
            accentColor={accentColor}
          />
          <NewsCarousel
            title={t("DiscoverHomePage.community-news")}
            posts={communityPosts}
            loading={isLoadingCommunity}
            onRefresh={fetchCommunityNews}
            accentColor={accentColor}
          />
        </VStack>

        <VStack spacing={5} align="stretch">
          <Section
            title={t("DiscoverHomePage.hotModpacks", { source: "CurseForge" })}
            headExtra={
              <CommonIconButton
                icon={LuRefreshCcw}
                label="refresh-cf-modpacks"
                onClick={() => fetchHotModpacks(OtherResourceSource.CurseForge)}
                size="sm"
                fontSize="sm"
                isDisabled={isLoadingCfModpacks}
              />
            }
            mt={1}
          >
            <HotModpackGrid
              items={cfModpacks}
              loading={isLoadingCfModpacks}
              accentColor={primaryColor}
            />
          </Section>

          <Section
            title={t("DiscoverHomePage.hotModpacks", { source: "Modrinth" })}
            headExtra={
              <CommonIconButton
                icon={LuRefreshCcw}
                label="refresh-mr-modpacks"
                onClick={() => fetchHotModpacks(OtherResourceSource.Modrinth)}
                size="sm"
                fontSize="sm"
                isDisabled={isLoadingMrModpacks}
              />
            }
            mt={1}
          >
            <HotModpackGrid
              items={mrModpacks}
              loading={isLoadingMrModpacks}
              accentColor={primaryColor}
            />
          </Section>
        </VStack>
      </VStack>
    </Section>
  );
};

export default HomePage;

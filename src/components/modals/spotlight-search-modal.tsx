import {
  Center,
  Divider,
  HStack,
  Highlight,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  Kbd,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Spinner,
  Tag,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuSearch } from "react-icons/lu";
import stringSimilarity from "string-similarity";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import PlayerAvatar from "@/components/player-avatar";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useRoutingHistory } from "@/contexts/routing-history";
import { useSharedModals } from "@/contexts/shared-modal";
import { OtherResourceSource, OtherResourceType } from "@/enums/resource";
import { OtherResourceInfo } from "@/models/resource";
import { ResourceService } from "@/services/resource";
import { generatePlayerDesc } from "@/utils/account";
import { generateInstanceDesc } from "@/utils/instance";
import { translateTag } from "@/utils/resource";

interface SearchResult {
  type: "page" | "instance" | "player" | "curseforge" | "modrinth";
  icon?: string | React.ReactNode;
  title: string;
  description: string;
  url?: string;
  action?: () => void;
  // Optional members for online resource search
  translatedDescription?: string;
  translatedTitle?: string;
  tags?: string[];
  source?: OtherResourceSource;
  resourceType?: OtherResourceType;
}

const SpotlightSearchModal: React.FC<Omit<ModalProps, "children">> = ({
  ...props
}) => {
  // constants for online resource search
  const RESOURCES_PER_REQUEST = 3;
  const MIN_RELEVANCE_SCORE = 0.45;
  const MAX_SEARCH_RESULTS = 3;

  const { t } = useTranslation();
  const router = useRouter();
  const { history } = useRoutingHistory();
  const { openSharedModal } = useSharedModals();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const showZhTrans =
    config.general.general.language === "zh-Hans" &&
    config.general.functionality.resourceTranslation;
  const searchAbortControllerRef = useRef<AbortController | null>(null);

  const [queryText, setQueryText] = useState<string>("");
  const [instantRes, setInstantRes] = useState<SearchResult[]>([]);
  const [networkSearchResults, setNetworkSearchResults] = useState<
    SearchResult[]
  >([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const { getPlayerList, getInstanceList } = useGlobalData();

  const convertResourceToSearchResult = useCallback(
    (resource: OtherResourceInfo): SearchResult => ({
      type:
        resource.source === OtherResourceSource.CurseForge
          ? "curseforge"
          : "modrinth",
      icon: resource.iconSrc,
      title: resource.name,
      translatedTitle: resource.translatedName,
      description: resource.description,
      translatedDescription: resource.translatedDescription,
      tags: resource.tags,
      source: resource.source,
      resourceType: resource.type,
      action: () =>
        openSharedModal("download-specific-resource", {
          resource,
        }),
    }),
    [openSharedModal]
  );

  const handleInstantSearch = useCallback(
    (query: string): SearchResult[] => {
      const keywords = query.trim().toLowerCase().split(/\s+/);
      if (keywords.length === 0) return [];

      let routingHistoryMatches: SearchResult[] = [];
      if (query.startsWith("/") && query.length > 1) {
        let route = [...history]
          .reverse()
          .find((r) => r.startsWith(query.trim().toLowerCase()));
        routingHistoryMatches = route
          ? [
              {
                type: "page",
                title: route,
                description: t("SpotlightSearchModal.result.recentViewed"),
                url: route,
              } as SearchResult,
            ]
          : [];
      }

      const playerMatches =
        (getPlayerList() || [])
          .filter((player) => {
            const name = player.name.toLowerCase();
            const authAccount = player.authAccount?.toLowerCase() || "";
            return keywords.some(
              (kw) => name.includes(kw) || authAccount.includes(kw)
            );
          })
          .map(
            (player) =>
              ({
                type: "player",
                icon: (
                  <PlayerAvatar
                    boxSize="28px"
                    objectFit="cover"
                    avatar={player.avatar}
                  />
                ),
                title: player.name,
                description: generatePlayerDesc(player, true),
                url: `/accounts`,
              }) as SearchResult
          ) || [];

      const instanceMatches =
        (getInstanceList() || [])
          .filter((instance) => {
            const name = instance.name.toLowerCase();
            const version = instance.version.toLowerCase();
            const loaderType = instance.modLoader.loaderType.toLowerCase();
            return keywords.some(
              (kw) =>
                name.includes(kw) ||
                version.includes(kw) ||
                (loaderType.includes(kw) && loaderType !== "unknown")
            );
          })
          .map(
            (instance) =>
              ({
                type: "instance",
                icon: instance.iconSrc,
                title: instance.name,
                description: generateInstanceDesc(instance),
                url: `/instances/details/${encodeURIComponent(instance.id)}`,
              }) as SearchResult
          ) || [];

      return [...routingHistoryMatches, ...playerMatches, ...instanceMatches];
    },
    [getPlayerList, getInstanceList, history, t]
  );

  const handleResourceSearch = useCallback(
    (query: string): SearchResult[] => {
      if (!query.trim()) return [];

      // Resource types ordered by popularity for generating search option buttons
      const resourceTypes = [
        OtherResourceType.Mod,
        OtherResourceType.ModPack,
        OtherResourceType.ResourcePack,
        OtherResourceType.ShaderPack,
        OtherResourceType.World,
        OtherResourceType.DataPack,
      ];

      const createResult =
        (platform: "curseforge" | "modrinth", source: OtherResourceSource) =>
        (type: OtherResourceType): SearchResult => ({
          type: platform,
          description: "",
          title: t(`SpotlightSearchModal.resource.${type}`, { query }),
          action: () =>
            openSharedModal(
              type === OtherResourceType.ModPack
                ? "download-modpack"
                : "download-resource",
              {
                initialSearchQuery: query,
                initialDownloadSource: source,
                ...(type !== OtherResourceType.ModPack && {
                  initialResourceType: type,
                }),
              }
            ),
        });

      const resourceSearchResults: SearchResult[] = [
        ...resourceTypes.map(
          createResult("curseforge", OtherResourceSource.CurseForge)
        ),
        ...resourceTypes
          .filter((type) => type !== OtherResourceType.World) // Modrinth doesn't host worlds
          .map(createResult("modrinth", OtherResourceSource.Modrinth)),
      ];

      return resourceSearchResults;
    },
    [openSharedModal, t]
  );

  const handleAllSearch = useCallback(
    (query: string): SearchResult[] => {
      const instantResults = handleInstantSearch(query);
      const resourceResults = handleResourceSearch(query);
      return [...instantResults, ...networkSearchResults, ...resourceResults];
    },
    [handleInstantSearch, handleResourceSearch, networkSearchResults]
  );

  const performNetworkSearch = useCallback(
    async (query: string, signal?: AbortSignal): Promise<SearchResult[]> => {
      if (!query.trim()) return [];

      // Priority resource types for network search - performs concurrent searches
      // 4 resource types * 2 sources * 3 results per request = 24 results before filtering
      const priorityResourceTypes = [
        OtherResourceType.Mod,
        OtherResourceType.ModPack,
        OtherResourceType.ResourcePack,
        OtherResourceType.ShaderPack,
      ];
      const sources = Object.values(OtherResourceSource);

      try {
        const searchPromises = priorityResourceTypes.flatMap((resourceType) =>
          sources.map(async (source) => {
            if (signal?.aborted) return [];

            const response = await ResourceService.fetchResourceListByName(
              resourceType,
              query,
              "All",
              "All",
              source === OtherResourceSource.CurseForge
                ? "Popularity"
                : "downloads",
              source,
              0,
              RESOURCES_PER_REQUEST
            );

            if (signal?.aborted || response.status !== "success") {
              return [];
            }

            return response.data.list
              .map((resource) => {
                const relevanceScore = Math.max(
                  stringSimilarity.compareTwoStrings(
                    query.toLowerCase(),
                    resource.name.toLowerCase()
                  ),
                  stringSimilarity.compareTwoStrings(
                    query,
                    resource.translatedName || ""
                  )
                );

                return { resource, relevanceScore };
              })
              .filter(
                ({ relevanceScore }) => relevanceScore > MIN_RELEVANCE_SCORE
              )
              .map(({ resource }) => convertResourceToSearchResult(resource));
          })
        );

        const searchResults = await Promise.allSettled(searchPromises);

        const results: SearchResult[] = [];
        searchResults.forEach((result) => {
          if (result.status === "fulfilled") {
            results.push(...result.value);
          }
        });

        const cfResults = results
          .filter((res) => res.source === OtherResourceSource.CurseForge)
          .slice(0, MAX_SEARCH_RESULTS);
        const mrResults = results
          .filter((res) => res.source === OtherResourceSource.Modrinth)
          .slice(0, MAX_SEARCH_RESULTS);

        return [...cfResults, ...mrResults];
      } catch (error) {
        if (!signal?.aborted) {
          logger.error("Network search error:", error);
        }
        return [];
      }
    },
    [convertResourceToSearchResult]
  );

  useEffect(() => {
    setInstantRes(handleAllSearch(queryText));
  }, [queryText, handleAllSearch]);

  // Handle network search with debounce and abort control
  useEffect(() => {
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }

    if (!queryText.trim()) {
      setNetworkSearchResults([]);
      setIsSearching(false);
      searchAbortControllerRef.current = null;
      return;
    }

    const debounceTimer = setTimeout(() => {
      const controller = new AbortController();
      searchAbortControllerRef.current = controller;
      setIsSearching(true);

      setNetworkSearchResults([]);

      performNetworkSearch(queryText, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) {
            setNetworkSearchResults(results);
            setIsSearching(false);
            searchAbortControllerRef.current = null;
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            logger.error("Network search error:", error);
            setNetworkSearchResults([]);
            setIsSearching(false);
            searchAbortControllerRef.current = null;
          }
        });
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [queryText, performNetworkSearch]);

  useEffect(() => {
    if (!props.isOpen) {
      setQueryText("");
      setNetworkSearchResults([]);
      setIsSearching(false);
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
        searchAbortControllerRef.current = null;
      }
    }
  }, [props.isOpen]);

  const groupSearchResults = () => {
    const groupedMap = new Map<string, React.ReactNode[]>();

    let idx = 0;

    for (const res of instantRes) {
      const itemNode = (
        <OptionItem
          key={`${res.type}-${res.title}`}
          title={
            <Text fontSize="xs-sm">
              <Highlight
                query={queryText.trim().toLowerCase().split(/\s+/)}
                styles={{ bg: "yellow.200" }}
              >
                {showZhTrans && res.translatedTitle
                  ? `${res.translatedTitle} | ${res.title}`
                  : res.title}
              </Highlight>
            </Text>
          }
          titleExtra={
            res.tags &&
            res.tags.length > 0 && (
              <HStack spacing={1}>
                {res.tags
                  .filter((t) => translateTag(t, res.resourceType, res.source))
                  .map((tag) => (
                    <Tag
                      key={tag}
                      colorScheme={primaryColor}
                      className="tag-xs"
                    >
                      {translateTag(tag, res.resourceType, res.source)}
                    </Tag>
                  ))}
              </HStack>
            )
          }
          description={
            <Text fontSize="xs" className="secondary-text">
              {(showZhTrans && res.translatedDescription) || res.description}
            </Text>
          }
          prefixElement={
            typeof res.icon === "string" ? (
              <Image
                boxSize="28px"
                objectFit="cover"
                src={res.icon}
                alt={res.title}
              />
            ) : (
              res.icon
            )
          }
          isFullClickZone
          onClick={() => {
            if (res.action) {
              res.action();
            } else if (res.url) {
              router.push(res.url);
            }
            setQueryText("");
            props.onClose?.();
          }}
        >
          {idx === 0 ? <Kbd>Enter</Kbd> : ""}
        </OptionItem>
      );

      if (!groupedMap.has(res.type)) groupedMap.set(res.type, []);
      groupedMap.get(res.type)!.push(itemNode);
      idx += 1;
    }

    return [...groupedMap.entries()].map(([type, items]) => (
      <OptionItemGroup
        key={type}
        title={t(`SpotlightSearchModal.result.${type}`)}
        titleExtra={<CountTag count={items.length} />}
        items={items}
        withInCard={false}
        maxFirstVisibleItems={3}
      />
    ));
  };

  return (
    <Modal scrollBehavior="inside" {...props}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <InputGroup size="md">
            <InputLeftElement pointerEvents="none" h="100%" w="auto">
              {isSearching ? <Spinner size="sm" /> : <LuSearch />}
            </InputLeftElement>
            <Input
              variant="unstyled"
              borderRadius={0}
              pl={6}
              placeholder={t("SpotlightSearchModal.input.placeholder")}
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && instantRes.length > 0) {
                  const firstResult = instantRes[0];
                  if (firstResult.action) {
                    firstResult.action();
                  } else if (firstResult.url) {
                    router.push(firstResult.url);
                  }
                  setQueryText("");
                  props.onClose?.();
                }
              }}
            />
          </InputGroup>
        </ModalHeader>
        <Divider />
        <ModalBody minH="8rem" overflowY="auto">
          {!queryText && (
            <Center h="6rem">
              <Text className="secondary-text">
                ✨&nbsp;{t("SpotlightSearchModal.tip")}
              </Text>
            </Center>
          )}
          {queryText && instantRes.length > 0 && (
            <VStack spacing={4} align="stretch" my={2}>
              {groupSearchResults()}
            </VStack>
          )}
          {queryText && instantRes.length === 0 && (
            <Center h="6rem">
              <Empty
                description={t("SpotlightSearchModal.empty")}
                withIcon={false}
                size="sm"
              />
            </Center>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SpotlightSearchModal;

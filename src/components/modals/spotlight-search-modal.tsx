import {
  Center,
  Divider,
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
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuSearch } from "react-icons/lu";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { useGlobalData } from "@/contexts/global-data";
import { useRoutingHistory } from "@/contexts/routing-history";
import { useSharedModals } from "@/contexts/shared-modal";
import { OtherResourceSource, OtherResourceType } from "@/enums/resource";
import { generatePlayerDesc } from "@/utils/account";
import { generateInstanceDesc } from "@/utils/instance";
import { base64ImgSrc } from "@/utils/string";

interface SearchResult {
  type: "page" | "instance" | "player" | "curseforge" | "modrinth";
  icon: string;
  title: string;
  description: string;
  url?: string;
  action?: () => void;
}

const SpotlightSearchModal: React.FC<Omit<ModalProps, "children">> = ({
  ...props
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { history } = useRoutingHistory();
  const { openSharedModal } = useSharedModals();

  const [queryText, setQueryText] = useState<string>("");
  const [instantRes, setInstantRes] = useState<SearchResult[]>([]);

  const { getPlayerList, getInstanceList } = useGlobalData();

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
                icon: "",
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
                icon: base64ImgSrc(player.avatar),
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

      const resourceTypes = Object.values(OtherResourceType);

      const createResult =
        (platform: string, source: OtherResourceSource) =>
        (type: OtherResourceType): SearchResult => ({
          type: platform as "curseforge" | "modrinth",
          icon: "",
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
      return [...instantResults, ...resourceResults];
    },
    [handleInstantSearch, handleResourceSearch]
  );

  useEffect(() => {
    setInstantRes(handleAllSearch(queryText));
  }, [queryText, handleAllSearch]);

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
                {res.title}
              </Highlight>
            </Text>
          }
          description={
            <Text fontSize="xs" className="secondary-text">
              <Highlight
                query={queryText.trim().toLowerCase().split(/\s+/)}
                styles={{ bg: "yellow.200" }}
              >
                {res.description}
              </Highlight>
            </Text>
          }
          prefixElement={
            res.icon ? (
              <Image
                boxSize="28px"
                objectFit="cover"
                src={res.icon}
                alt={res.title}
              />
            ) : null
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
              <LuSearch />
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

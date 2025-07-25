import {
  Avatar,
  Box,
  Button,
  HStack,
  Input,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Tag,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuDownload, LuGlobe, LuUpload } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import Empty from "@/components/common/empty";
import { OptionItemProps } from "@/components/common/option-item";
import { VirtualOptionItemGroup } from "@/components/common/option-item-virtual";
import DownloadSpecificResourceModal from "@/components/modals/download-specific-resource-modal";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useToast } from "@/contexts/toast";
import {
  OtherResourceType,
  datapackTagList,
  modTagList,
  modpackTagList,
  resourcePackTagList,
  shaderPackTagList,
  sortByLists,
  worldTagList,
} from "@/enums/resource";
import { GetStateFlag } from "@/hooks/get-state";
import { InstanceSummary } from "@/models/instance/misc";
import { GameResourceInfo, OtherResourceInfo } from "@/models/resource";
import { ResourceService } from "@/services/resource";
import { ISOToDate } from "@/utils/datetime";
import { formatDisplayCount } from "@/utils/string";

interface ResourceDownloaderProps {
  resourceType: OtherResourceType;
}

interface ResourceDownloaderMenuProps {
  label: string;
  displayText: string;
  onChange: (value: string) => void;
  defaultValue: string;
  options: React.ReactNode;
  value: string;
  width?: number;
}

interface ResourceDownloaderListProps {
  list: OtherResourceInfo[];
  hasMore: boolean;
  loadMore: () => void;
}

const tagLists: Record<string, any> = {
  mod: modTagList,
  world: worldTagList,
  resourcepack: resourcePackTagList,
  shader: shaderPackTagList,
  modpack: modpackTagList,
  datapack: datapackTagList,
};

const downloadSourceLists: Record<string, string[]> = {
  mod: ["CurseForge", "Modrinth"],
  world: ["CurseForge"],
  resourcepack: ["CurseForge", "Modrinth"],
  shader: ["CurseForge", "Modrinth"],
  modpack: ["CurseForge", "Modrinth"],
  datapack: ["CurseForge", "Modrinth"],
};

const ResourceDownloaderMenu: React.FC<ResourceDownloaderMenuProps> = ({
  label,
  displayText,
  onChange,
  defaultValue,
  options,
  value,
  width = 28,
}) => {
  return (
    <HStack>
      <Text>{label}</Text>
      <Menu>
        <MenuButton
          as={Button}
          size="xs"
          w={width}
          variant="outline"
          fontSize="xs"
          textAlign="left"
          rightIcon={<LuChevronDown />}
        >
          <Text className="ellipsis-text" maxW={width}>
            {displayText}
          </Text>
        </MenuButton>
        <MenuList maxH="40vh" minW={width} overflow="auto">
          <MenuOptionGroup
            defaultValue={defaultValue}
            value={value}
            type="radio"
            onChange={(value) => {
              onChange(value as string);
            }}
          >
            {options}
          </MenuOptionGroup>
        </MenuList>
      </Menu>
    </HStack>
  );
};

const ResourceDownloaderList: React.FC<ResourceDownloaderListProps> = ({
  list,
  hasMore,
  loadMore,
}) => {
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const router = useRouter();
  const { getInstanceList } = useGlobalData();

  const [selectedItem, setSelectedItem] = useState<OtherResourceInfo | null>(
    null
  );
  const [curInstance, setCurInstance] = useState<InstanceSummary | undefined>();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { t } = useTranslation();

  const translateTag = (
    tag: string,
    resourceType: string,
    downloadSource?: string
  ) => {
    if (downloadSource === "CurseForge" || downloadSource === "Modrinth") {
      const tagList = (tagLists[resourceType] || modpackTagList)[
        downloadSource
      ];
      let allTags: string[] = [];
      if (typeof tagList === "object" && tagList !== null) {
        const keys = Object.keys(tagList);
        const values = Object.values(tagList).flat() as string[];
        allTags = [...keys, ...values];
      }
      if (!allTags.includes(tag)) return "";
      return t(
        `ResourceDownloader.${resourceType}TagList.${downloadSource}.${tag}`
      );
    }
    return tag;
  };

  useEffect(() => {
    const instanceList = getInstanceList() || [];
    const { id } = router.query;
    const instanceId = Array.isArray(id) ? id[0] : id;
    const currentInstance = instanceList.find(
      (instance) => instance.id === instanceId
    );
    setCurInstance(currentInstance);
  }, [getInstanceList, router.query]);

  const buildOptionItems = (item: OtherResourceInfo): OptionItemProps => ({
    title: (
      <Text fontSize="xs-sm" className="ellipsis-text">
        {item.translatedName
          ? `${item.translatedName}｜${item.name}`
          : item.name}
      </Text>
    ),
    titleExtra: (
      <HStack spacing={1}>
        {(() => {
          const translatedTags = item.tags
            .map((t) => ({
              raw: t,
              translated: translateTag(t, item.type, item.source),
            }))
            .filter((t) => t.translated);

          const visibleTags = translatedTags.slice(0, 3);
          const extraCount = translatedTags.length - visibleTags.length;

          return (
            <>
              {visibleTags.map((t) => (
                <Tag key={t.raw} colorScheme={primaryColor} className="tag-xs">
                  {t.translated}
                </Tag>
              ))}
              {extraCount > 0 && (
                <Tag
                  colorScheme={primaryColor}
                  className="tag-xs"
                  variant="outline"
                >
                  +{extraCount}
                </Tag>
              )}
            </>
          );
        })()}
      </HStack>
    ),
    titleLineWrap: false,
    description: (
      <VStack
        fontSize="xs"
        className="secondary-text"
        spacing={1}
        align="flex-start"
        w="100%"
      >
        <Text overflow="hidden" className="ellipsis-text">
          {item.description}
        </Text>
        <HStack spacing={6}>
          <HStack spacing={1}>
            <LuUpload />
            <Text>{ISOToDate(item.lastUpdated)}</Text>
          </HStack>
          <HStack spacing={1}>
            <LuDownload />
            <Text>{formatDisplayCount(item.downloads)}</Text>
          </HStack>
          {item.source && (
            <HStack spacing={1}>
              <LuGlobe />
              <Text>{item.source}</Text>
            </HStack>
          )}
        </HStack>
      </VStack>
    ),
    prefixElement: (
      <Avatar
        src={item.iconSrc}
        name={item.name}
        boxSize="42px"
        borderRadius="4px"
      />
    ),
    children: <></>,
    isFullClickZone: true,
    onClick: () => {
      setSelectedItem(item);
      onOpen();
    },
    fontWeight: 400,
  });

  return (
    <>
      {list.length > 0 ? (
        <VirtualOptionItemGroup
          h="100%"
          items={list.map(buildOptionItems)}
          useInfiniteScroll
          hasMore={hasMore}
          loadMore={loadMore}
        />
      ) : (
        <Empty withIcon={false} size="sm" />
      )}
      {selectedItem && (
        <DownloadSpecificResourceModal
          key={selectedItem.id}
          isOpen={isOpen}
          onClose={onClose}
          resource={selectedItem}
          curInstanceMajorVersion={curInstance?.majorVersion}
          curInstanceVersion={curInstance?.version}
          curInstanceModLoader={
            selectedItem.type === OtherResourceType.Mod &&
            curInstance?.modLoader.loaderType !== "Unknown"
              ? curInstance?.modLoader.loaderType
              : undefined
          }
        />
      )}
    </>
  );
};

const ResourceDownloader: React.FC<ResourceDownloaderProps> = ({
  resourceType,
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const toast = useToast();
  const { getGameVersionList } = useGlobalData();

  const [gameVersionList, setGameVersionList] = useState<string[] | undefined>(
    undefined
  );

  const [resourceList, setResourceList] = useState<OtherResourceInfo[]>([]);
  const [isLoadingResourceList, setIsLoadingResourceList] =
    useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [pageSize, setPageSize] = useState<number>(10);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [gameVersion, setGameVersion] = useState<string>("All");
  const [selectedTag, setSelectedTag] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("Popularity");
  const [downloadSource, setDownloadSource] = useState<
    "CurseForge" | "Modrinth"
  >("CurseForge");

  const searchQueryRef = useRef(searchQuery);
  const pageRef = useRef(0);

  const tagList = (tagLists[resourceType] || modpackTagList)[downloadSource];
  const sortByList = sortByLists[downloadSource];

  const onDownloadSourceChange = (e: string) => {
    setDownloadSource(e === "CurseForge" ? "CurseForge" : "Modrinth");
    setSelectedTag("All");
    setSortBy(e === "CurseForge" ? "Popularity" : "relevance");
  };

  const handleFetchResourceListByName = useCallback(
    async (
      resourceType: string,
      searchQuery: string,
      gameVersion: string,
      selectedTag: string,
      sortBy: string,
      downloadSource: string,
      page: number,
      pageSize: number,
      isLoadMore: boolean = false
    ) => {
      if (page === 0) setIsLoadingResourceList(true);

      ResourceService.fetchResourceListByName(
        resourceType,
        searchQuery,
        gameVersion,
        selectedTag,
        sortBy,
        downloadSource,
        page,
        pageSize
      )
        .then((response) => {
          if (response.status === "success") {
            const resourceData = response.data.list;
            if (!isLoadMore) {
              setResourceList(resourceData);
            } else {
              setResourceList((prevList) => [...prevList, ...resourceData]);
            }
            setHasMore(response.data.total > (page + 1) * pageSize);
          } else {
            setResourceList([]);
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        })
        .finally(() => {
          setIsLoadingResourceList(false);
        });
    },
    [toast]
  );

  const loadMore = () => {
    if (!hasMore) return;
    const currentPage = pageRef.current;
    handleFetchResourceListByName(
      resourceType,
      searchQueryRef.current,
      gameVersion,
      selectedTag,
      sortBy,
      downloadSource,
      currentPage + 1,
      pageSize,
      true
    );
    pageRef.current += 1;
  };

  const reFetchResourceList = useCallback(() => {
    pageRef.current = 0;

    handleFetchResourceListByName(
      resourceType,
      searchQueryRef.current, // useRef to avoid unnecessary re-fetch
      gameVersion,
      selectedTag,
      sortBy,
      downloadSource,
      0,
      pageSize
    );
  }, [
    handleFetchResourceListByName,
    resourceType,
    gameVersion,
    selectedTag,
    sortBy,
    downloadSource,
    pageSize,
  ]);

  useEffect(() => {
    getGameVersionList().then((list) => {
      if (list && list !== GetStateFlag.Cancelled) {
        const versionList = list
          .filter((version: GameResourceInfo) => version.gameType === "release")
          .map((version: GameResourceInfo) => version.id);
        setGameVersionList(["All", ...versionList]);
      } else {
        setGameVersionList([]);
      }
    });
  }, [getGameVersionList]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    reFetchResourceList();
  }, [reFetchResourceList]);

  useEffect(() => {
    if (
      resourceType &&
      !(downloadSourceLists[resourceType] || []).includes(downloadSource)
    ) {
      onDownloadSourceChange("CurseForge");
    }
    setSelectedTag("All");
  }, [resourceType, downloadSource]);

  const renderTagMenuOptions = () => {
    if (typeof tagList === "object" && tagList !== null) {
      return Object.entries(tagList).flatMap(([group, tags]) => [
        group === "All" || resourceType === OtherResourceType.Mod ? (
          <MenuItemOption key={`group-${group}`} value={group} fontSize="xs">
            {t(
              `ResourceDownloader.${resourceType}TagList.${downloadSource}.${group}`
            ) || group}
          </MenuItemOption>
        ) : (
          <MenuItemOption
            key={`group-${group}`}
            isDisabled
            fontWeight="bold"
            color="gray.500"
            fontSize="xs"
            cursor="default"
            _disabled={{ bg: "transparent", cursor: "default" }}
          >
            {t(
              `ResourceDownloader.${resourceType}TagList.${downloadSource}.${group}`
            ) || group}
          </MenuItemOption>
        ),
        ...(Array.isArray(tags)
          ? tags
              .filter((item: string) => item !== "All")
              .map((item: string) => (
                <MenuItemOption key={item} value={item} fontSize="xs" pl={6}>
                  {t(
                    `ResourceDownloader.${resourceType}TagList.${downloadSource}.${item}`
                  ) || item}
                </MenuItemOption>
              ))
          : []),
      ]);
    }
    return [];
  };

  return (
    <VStack fontSize="xs" h="100%">
      <HStack gap={3}>
        <ResourceDownloaderMenu
          label={t("ResourceDownloader.label.tag")}
          displayText={t(
            `ResourceDownloader.${resourceType}TagList.${downloadSource}.${selectedTag}`
          )}
          onChange={setSelectedTag}
          value={selectedTag}
          defaultValue={"All"}
          options={renderTagMenuOptions()}
        />

        <ResourceDownloaderMenu
          label={t("ResourceDownloader.label.gameVer")}
          displayText={
            gameVersion === "All"
              ? t("ResourceDownloader.versionList.All")
              : gameVersion
          }
          onChange={setGameVersion}
          value={gameVersion}
          defaultValue={"All"}
          options={
            gameVersionList ? (
              gameVersionList.map((item) => (
                <MenuItemOption key={item} value={item} fontSize="xs">
                  {item === "All"
                    ? t("ResourceDownloader.versionList.All")
                    : item}
                </MenuItemOption>
              ))
            ) : (
              <MenuItemOption isDisabled px={0}>
                <BeatLoader size={8} />
              </MenuItemOption>
            )
          }
          width={20}
        />

        <ResourceDownloaderMenu
          label={t("ResourceDownloader.label.source")}
          displayText={downloadSource}
          onChange={onDownloadSourceChange}
          value={downloadSource}
          defaultValue={"CurseForge"}
          options={downloadSourceLists[resourceType].map((item) => (
            <MenuItemOption key={item} value={item} fontSize="xs">
              {item}
            </MenuItemOption>
          ))}
          width={28}
        />

        <ResourceDownloaderMenu
          label={t("ResourceDownloader.label.sortBy")}
          displayText={t(
            `ResourceDownloader.sortByList.${downloadSource}.${sortBy}`
          )}
          onChange={setSortBy}
          value={sortBy}
          defaultValue={
            downloadSource === "CurseForge" ? "Popularity" : "relevance"
          }
          options={sortByList.map((item) => (
            <MenuItemOption key={item} value={item} fontSize="xs">
              {t(`ResourceDownloader.sortByList.${downloadSource}.${item}`)}
            </MenuItemOption>
          ))}
          width={24}
        />
      </HStack>

      <HStack gap={3}>
        <Text whiteSpace="nowrap">{t("ResourceDownloader.label.name")}</Text>
        <Input
          placeholder={t("ResourceDownloader.label.name")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          focusBorderColor={`${primaryColor}.500`}
          size="xs"
          w={72}
          onKeyDown={(e) => {
            if (e.key === "Enter") reFetchResourceList();
          }}
        />
        <Button
          colorScheme={primaryColor}
          size="xs"
          onClick={reFetchResourceList}
          px={5}
        >
          {t("ResourceDownloader.button.search")}
        </Button>
      </HStack>

      <Box flexGrow={1} w="100%" overflowX="hidden">
        {isLoadingResourceList ? (
          <VStack mt={8}>
            <BeatLoader size={16} color="gray" />
          </VStack>
        ) : (
          <ResourceDownloaderList
            list={resourceList}
            hasMore={hasMore}
            loadMore={loadMore}
          />
        )}
      </Box>
    </VStack>
  );
};

export default ResourceDownloader;

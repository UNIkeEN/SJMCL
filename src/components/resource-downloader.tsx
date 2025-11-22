import {
  Avatar,
  Box,
  Button,
  Grid,
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
import { ModLoaderType } from "@/enums/instance";
import {
  OtherResourceSource,
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
import { GameClientResourceInfo, OtherResourceInfo } from "@/models/resource";
import { ResourceService } from "@/services/resource";
import { ISOToDate } from "@/utils/datetime";
import { translateTag } from "@/utils/resource";
import { formatDisplayCount } from "@/utils/string";

interface ResourceDownloaderProps {
  resourceType: OtherResourceType;
  initialSearchQuery?: string;
  initialDownloadSource?: OtherResourceSource;
  curInstance?: InstanceSummary;
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
  curInstance?: InstanceSummary;
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

const downloadSourceLists: Record<string, OtherResourceSource[]> = {
  mod: [OtherResourceSource.CurseForge, OtherResourceSource.Modrinth],
  world: [OtherResourceSource.CurseForge],
  resourcepack: [OtherResourceSource.CurseForge, OtherResourceSource.Modrinth],
  shader: [OtherResourceSource.CurseForge, OtherResourceSource.Modrinth],
  modpack: [OtherResourceSource.CurseForge, OtherResourceSource.Modrinth],
  datapack: [OtherResourceSource.CurseForge, OtherResourceSource.Modrinth],
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
  curInstance,
  hasMore,
  loadMore,
}) => {
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const showZhTrans =
    config.general.general.language === "zh-Hans" &&
    config.general.functionality.resourceTranslation;

  const [selectedItem, setSelectedItem] = useState<OtherResourceInfo | null>(
    null
  );
  const { isOpen, onOpen, onClose } = useDisclosure();

  const buildOptionItems = (item: OtherResourceInfo): OptionItemProps => ({
    title: (
      <Text fontSize="xs-sm" className="ellipsis-text">
        {showZhTrans && item.translatedName
          ? `${item.translatedName} | ${item.name}`
          : item.name}
      </Text>
    ),
    titleExtra: (
      <HStack spacing={1} flex="0 0 auto">
        {(() => {
          const translatedTags = item.tags
            .map((t) => translateTag(t, item.type, item.source))
            .filter((t) => t);

          const visibleTags = translatedTags.slice(0, 3);
          const extraCount = translatedTags.length - visibleTags.length;

          return (
            <>
              {visibleTags.map((t, index) => (
                <Tag key={index} colorScheme={primaryColor} className="tag-xs">
                  {t}
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
        mt={0.5}
      >
        <Text overflow="hidden" className="ellipsis-text">
          {(showZhTrans && item.translatedDescription) || item.description}
        </Text>
        <Grid
          templateColumns="repeat(3, 1fr)"
          w={{ base: "sm", lg: "md", xl: "md" }}
        >
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
        </Grid>
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
          {...(selectedItem.type !== OtherResourceType.ModPack && {
            curInstanceMajorVersion: curInstance?.majorVersion,
            curInstanceVersion: curInstance?.version,
          })}
          {...(selectedItem.type === OtherResourceType.Mod &&
            curInstance?.modLoader.loaderType !== ModLoaderType.Unknown && {
              curInstanceModLoader: curInstance?.modLoader.loaderType,
            })}
        />
      )}
    </>
  );
};

const ResourceDownloader: React.FC<ResourceDownloaderProps> = ({
  resourceType,
  initialSearchQuery = "",
  initialDownloadSource = OtherResourceSource.CurseForge,
  curInstance,
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const toast = useToast();
  const { getGameVersionList } = useGlobalData();

  const [gameVersionList, setGameVersionList] = useState<string[]>([]);

  const [resourceList, setResourceList] = useState<OtherResourceInfo[]>([]);
  const [isLoadingResourceList, setIsLoadingResourceList] =
    useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [pageSize, setPageSize] = useState<number>(10);

  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);
  const [gameVersion, setGameVersion] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>(
    initialDownloadSource === OtherResourceSource.CurseForge
      ? "Popularity"
      : "relevance"
  );
  const [downloadSource, setDownloadSource] = useState<OtherResourceSource>(
    initialDownloadSource
  );

  const searchQueryRef = useRef(searchQuery);
  const pageRef = useRef(0);

  const tagList = (tagLists[resourceType] || modpackTagList)[downloadSource];
  const sortByList = sortByLists[downloadSource];

  const onDownloadSourceChange = (e: string) => {
    setDownloadSource(e as OtherResourceSource);
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
    if (!hasMore || !gameVersion) return;
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
    if (!gameVersion) return;
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
          .filter(
            (version: GameClientResourceInfo) => version.gameType === "release"
          )
          .map((version: GameClientResourceInfo) => version.id);
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
    const initialVersion = curInstance?.version || "All";
    if (
      gameVersionList.length > 0 &&
      gameVersionList.includes(initialVersion)
    ) {
      setGameVersion(initialVersion);
    } else {
      setGameVersion("All");
    }
  }, [curInstance?.version, gameVersionList]);

  useEffect(() => {
    if (
      resourceType &&
      !(downloadSourceLists[resourceType] || []).includes(downloadSource)
    ) {
      onDownloadSourceChange(OtherResourceSource.CurseForge);
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
              .filter((item) => item !== "All")
              .map((item, index) => (
                <MenuItemOption key={index} value={item} fontSize="xs" pl={6}>
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
              gameVersionList.map((item, index) => (
                <MenuItemOption key={index} value={item} fontSize="xs">
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
          defaultValue={OtherResourceSource.CurseForge}
          options={downloadSourceLists[resourceType].map((item, index) => (
            <MenuItemOption key={index} value={item} fontSize="xs">
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
            downloadSource === OtherResourceSource.CurseForge
              ? "Popularity"
              : "relevance"
          }
          options={sortByList.map((item, index) => (
            <MenuItemOption key={index} value={item} fontSize="xs">
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
            curInstance={curInstance}
            hasMore={hasMore}
            loadMore={loadMore}
          />
        )}
      </Box>
    </VStack>
  );
};

export default ResourceDownloader;

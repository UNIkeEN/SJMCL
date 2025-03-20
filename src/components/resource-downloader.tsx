import {
  Avatar,
  Box,
  Button,
  Center,
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
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuDownload, LuGlobe, LuUpload } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import Empty from "@/components/common/empty";
import { OptionItemProps } from "@/components/common/option-item";
import { VirtualOptionItemGroup } from "@/components/common/option-item-virtual";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import {
  modTagList,
  modpackTagList,
  resourcePackTagList,
  shaderPackTagList,
  sortByList,
  worldTagList,
} from "@/enums/resource";
import { mockDownloadResourceList } from "@/models/mock/resource";
import { GameResourceInfo, OtherResourceInfo } from "@/models/resource";
import { ResourceService } from "@/services/resource";
import { ISOToDate } from "@/utils/datetime";

interface ResourceDownloaderProps {
  resourceType: string;
}

interface ResourceDownloaderMenuProps {
  label: string;
  displayText: string;
  onChange: (value: string) => void;
  defaultValue: string;
  options: React.ReactNode;
  width?: number;
}

interface ResourceDownloaderListProps {
  list: OtherResourceInfo[];
  hasMore: boolean;
  loadMore: () => void;
}

const ResourceDownloaderMenu: React.FC<ResourceDownloaderMenuProps> = ({
  label,
  displayText,
  onChange,
  defaultValue,
  options,
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
          {displayText}
        </MenuButton>
        <MenuList maxH="40vh" minW={width} overflow="auto">
          <MenuOptionGroup
            defaultValue={defaultValue}
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

  const buildOptionItems = (item: OtherResourceInfo): OptionItemProps => ({
    key: item.name,
    title: item.translatedName
      ? `${item.translatedName}｜${item.name}`
      : item.name,
    titleExtra: (
      <Wrap spacing={1}>
        {item.tags.map((tag, index) => (
          <WrapItem key={index}>
            <Tag colorScheme={primaryColor} className="tag-xs">
              {tag}
            </Tag>
          </WrapItem>
        ))}
      </Wrap>
    ),
    description: (
      <VStack
        fontSize="xs"
        className="secondary-text no-select"
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
            <Text>{item.downloads}</Text>
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
        boxSize="48px"
        borderRadius="4px"
      />
    ),
    children: <></>,
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

  const [gameVersionList, setGameVersionList] = useState<string[] | undefined>(
    undefined
  );

  const [resourceList, setResourceList] = useState<OtherResourceInfo[]>([]);
  const [isLoadingResourceList, setIsLoadingResourceList] =
    useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true); // use for infinite scroll

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [gameVersion, setGameVersion] = useState<string>("All");
  const [selectedTag, setSelectedTag] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("Relevancy");
  const [downloadSource, setDownloadSource] = useState<
    "CurseForge" | "Modrinth"
  >("CurseForge");

  const downloadSourceList = [
    "CurseForge",
    ...(resourceType === "world" ? [] : ["Modrinth"]),
  ];

  const tagList =
    resourceType === "mod"
      ? modTagList
      : resourceType === "world"
        ? worldTagList
        : resourceType === "resourcepack"
          ? resourcePackTagList
          : resourceType === "shaderpack"
            ? shaderPackTagList
            : modpackTagList;

  const finalTagList = tagList[downloadSource];
  const finalSortByList = sortByList[downloadSource];

  const onDownloadSourceChange = (e: string) => {
    setDownloadSource(e === "CurseForge" ? "CurseForge" : "Modrinth");
    setSelectedTag("All");
    setSortBy(e === "CurseForge" ? "Relevancy" : "Relevance");
  };

  const handleFetchGameVersionList = useCallback(async () => {
    const response = await ResourceService.fetchGameVersionList();
    if (response.status === "success") {
      const versionData = response.data;
      const versionList = versionData
        .filter((version: GameResourceInfo) => version.gameType === "release")
        .map((version: GameResourceInfo) => version.id);
      setGameVersionList(["All", ...versionList]);
    } else {
      setGameVersionList([]);
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
    }
  }, [toast]);

  const fetchResourceList = useCallback(async () => {
    // TBD
    setIsLoadingResourceList(true);
    setTimeout(() => {
      setHasMore(true);
      setResourceList(mockDownloadResourceList);
      setIsLoadingResourceList(false);
    }, 500);
  }, []);

  const loadMore = async () => {
    // TBD
    if (!hasMore) return;
    setTimeout(() => {
      setResourceList((prev) => [...prev, ...mockDownloadResourceList]);
      if (resourceList.length >= 24) setHasMore(false);
    }, 500);
  };

  useEffect(() => {
    handleFetchGameVersionList();
  }, [handleFetchGameVersionList]);

  useEffect(() => {
    fetchResourceList();
  }, [gameVersion, selectedTag, sortBy, downloadSource, fetchResourceList]);

  return (
    <VStack fontSize="xs" h="100%">
      <HStack gap={3}>
        <ResourceDownloaderMenu
          label={t("ResourceDownloader.label.tag")}
          displayText={t(
            `ResourceDownloader.${resourceType}TagList.${downloadSource}.${selectedTag}`
          )}
          onChange={setSelectedTag}
          defaultValue={"All"}
          options={finalTagList.map((item, key) => (
            <MenuItemOption key={key} value={item} fontSize="xs">
              {t(
                `ResourceDownloader.${resourceType}TagList.${downloadSource}.${item}`
              )}
            </MenuItemOption>
          ))}
        />

        <ResourceDownloaderMenu
          label={t("ResourceDownloader.label.gameVer")}
          displayText={
            gameVersion === "All"
              ? t("ResourceDownloader.versionList.All")
              : gameVersion
          }
          onChange={setGameVersion}
          defaultValue={"All"}
          options={
            gameVersionList ? (
              gameVersionList.map((item, key) => (
                <MenuItemOption key={key} value={item} fontSize="xs">
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
          defaultValue={"CurseForge"}
          options={downloadSourceList.map((item, key) => (
            <MenuItemOption key={key} value={item} fontSize="xs">
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
          defaultValue={
            downloadSource === "CurseForge" ? "Relevancy" : "Relevance"
          }
          options={finalSortByList.map((item, key) => (
            <MenuItemOption key={key} value={item} fontSize="xs">
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
        />
        <Button
          colorScheme={primaryColor}
          size="xs"
          onClick={fetchResourceList}
          px={5}
        >
          {t("ResourceDownloader.button.search")}
        </Button>
      </HStack>

      <Box flexGrow={1} w="100%">
        {isLoadingResourceList ? (
          <Center>
            <BeatLoader size={16} color="gray" />
          </Center>
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

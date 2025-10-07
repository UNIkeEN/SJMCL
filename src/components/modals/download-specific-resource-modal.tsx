import {
  Avatar,
  Box,
  Card,
  HStack,
  Image,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Stack,
  Tag,
  Text,
  Tooltip,
  VStack,
  Wrap,
} from "@chakra-ui/react";
import { downloadDir } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuDownload,
  LuExternalLink,
  LuPackage,
  LuUpload,
} from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { MenuSelector } from "@/components/common/menu-selector";
import NavMenu from "@/components/common/nav-menu";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { InstanceSubdirType, ModLoaderType } from "@/enums/instance";
import {
  OtherResourceSource,
  OtherResourceType,
  datapackTagList,
  modTagList,
  modpackTagList,
  resourcePackTagList,
  shaderPackTagList,
  worldTagList,
} from "@/enums/resource";
import { GetStateFlag } from "@/hooks/get-state";
import { useThemedCSSStyle } from "@/hooks/themed-css";
import {
  GameClientResourceInfo,
  OtherResourceFileInfo,
  OtherResourceInfo,
  OtherResourceVersionPack,
} from "@/models/resource";
import { TaskParam, TaskTypeEnums } from "@/models/task";
import { InstanceService } from "@/services/instance";
import { ResourceService } from "@/services/resource";
import { TaskService } from "@/services/task";
import { ISOToDate } from "@/utils/datetime";
import { formatDisplayCount } from "@/utils/string";

interface DownloadSpecificResourceModalProps
  extends Omit<ModalProps, "children"> {
  resource: OtherResourceInfo;
  curInstanceMajorVersion?: string;
  curInstanceVersion?: string;
  curInstanceModLoader?: ModLoaderType;
}

const DownloadSpecificResourceModal: React.FC<
  DownloadSpecificResourceModalProps
> = ({
  resource,
  curInstanceMajorVersion,
  curInstanceVersion,
  curInstanceModLoader,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const router = useRouter();
  const toast = useToast();
  const themedStyles = useThemedCSSStyle();
  const primaryColor = config.appearance.theme.primaryColor;
  const showZhTrans =
    config.general.general.language === "zh-Hans" &&
    config.general.functionality.resourceTranslation;

  const [gameVersionList, setGameVersionList] = useState<string[]>([]);
  const [versionLabels, setVersionLabels] = useState<string[]>([]);
  const [selectedVersionLabel, setSelectedVersionLabel] = useState<string>("");
  const [selectedModLoader, setSelectedModLoader] = useState<
    ModLoaderType | "All"
  >(curInstanceModLoader || "All");
  const [isVersionPacksLoading, setIsLoadingVersionPacks] =
    useState<boolean>(true);
  const [versionPacks, setVersionPacks] = useState<OtherResourceVersionPack[]>(
    []
  );
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

  const { getGameVersionList, isGameVersionListLoading } = useGlobalData();
  const { openSharedModal, closeSharedModal } = useSharedModals();

  const modLoaderLabels = [
    "All",
    ModLoaderType.Fabric,
    ModLoaderType.Forge,
    ModLoaderType.NeoForge,
  ];

  const tagLists: Record<string, any> = {
    mod: modTagList,
    world: worldTagList,
    resourcepack: resourcePackTagList,
    shader: shaderPackTagList,
    datapack: datapackTagList,
  };

  const iconBackgroundColor: Record<string, string> = {
    alpha: "yellow.300",
    beta: "purple.500",
    release: "green.500",
  };

  const handleScheduleProgressiveTaskGroup = useCallback(
    (taskGroup: string, params: TaskParam[]) => {
      TaskService.scheduleProgressiveTaskGroup(taskGroup, params).then(
        (response) => {
          // success toast will now be called by task context group listener
          if (response.status !== "success") {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        }
      );
    },
    [toast]
  ); // this is because TaskContext is now inside the SharedModalContext, use a separated function to avoid circular dependency

  const translateTag = (
    tag: string,
    resourceType: string,
    downloadSource?: OtherResourceSource
  ) => {
    if (
      downloadSource === OtherResourceSource.CurseForge ||
      downloadSource === OtherResourceSource.Modrinth
    ) {
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

  const toCamelCaseLabel = (value: string): string => {
    return value
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((segment) =>
        segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
      )
      .join("");
  };

  const getTagColor = useMemo(() => {
    const colorPalette = [
      "green",
      "blue",
      "purple",
      "teal",
      "orange",
      "pink",
      "cyan",
      "yellow",
    ] as const;
    const cache = new Map<string, (typeof colorPalette)[number]>();

    return (tag: string) => {
      if (!cache.has(tag)) {
        const normalized = tag.toLowerCase();
        const hash = normalized
          .split("")
          .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 2147483647, 7);
        const paletteIndex = hash % colorPalette.length;
        cache.set(tag, colorPalette[paletteIndex]);
      }
      return cache.get(tag)!;
    };
  }, []);

  const shouldShowResourceLinks = Boolean(
    resource.websiteUrl || resource.mcmodId !== 0
  );

  const translatedTags = resource.tags
    .map((tag) => translateTag(tag, resource.type, resource.source))
    .filter((tag): tag is string => Boolean(tag));
  const visibleTags = translatedTags.slice(0, 3);
  const hiddenTags = translatedTags.slice(3);

  const versionLabelToParam = useCallback(
    (label: string) => {
      if (label === "All") return ["All"];
      if (resource.source === OtherResourceSource.Modrinth)
        return gameVersionList.filter((version) => version.startsWith(label));
      return [label];
    },
    [gameVersionList, resource.source]
  );

  const versionPackFilter = (pack: OtherResourceVersionPack): boolean => {
    const matchesVersion =
      selectedVersionLabel === "All" ||
      new RegExp(`^${selectedVersionLabel}(\\.|$)`).test(pack.name);

    return matchesVersion;
  };

  const buildVersionLabelItem = (version: string) => {
    return version !== "All"
      ? version
      : t("DownloadSpecificResourceModal.label.all");
  };

  const getDefaultFilePath = useCallback(async (): Promise<string | null> => {
    const resourceTypeToDirType: Record<string, InstanceSubdirType> = {
      mod: InstanceSubdirType.Mods,
      world: InstanceSubdirType.Saves,
      resourcepack: InstanceSubdirType.ResourcePacks,
      shader: InstanceSubdirType.ShaderPacks,
      datapack: InstanceSubdirType.Saves,
    };
    const dirType =
      resourceTypeToDirType[resource.type] ?? InstanceSubdirType.Root;

    let id = router.query.id;
    const instanceId = Array.isArray(id) ? id[0] : id;

    if (instanceId !== undefined) {
      return InstanceService.retrieveInstanceSubdirPath(
        instanceId,
        dirType
      ).then((response) => {
        if (response.status === "success") {
          return response.data;
        } else {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
          return null;
        }
      });
    }

    const defaultDownloadPath = await downloadDir();
    return defaultDownloadPath;
  }, [resource.type, router.query.id, toast]);

  const startDownload = async (
    item: OtherResourceFileInfo,
    translatedName?: string
  ) => {
    const dir = await getDefaultFilePath();
    const fileName = translatedName
      ? `[${translatedName}] ${item.fileName}`
      : item.fileName;
    const savepath = await save({
      defaultPath: dir + "/" + fileName,
    });
    if (!savepath) return;
    handleScheduleProgressiveTaskGroup(resource.type, [
      {
        src: item.downloadUrl,
        dest: savepath,
        sha1: item.sha1,
        taskType: TaskTypeEnums.Download,
      },
    ]);

    if (resource.type === OtherResourceType.ModPack) {
      closeSharedModal("download-specific-resource");
      closeSharedModal("download-modpack");
      router.push("/downloads");
    }
  };

  const getRecommendedFiles = useMemo((): OtherResourceFileInfo[] => {
    if (!curInstanceVersion || !versionPacks.length) return [];

    const matchingPacks = versionPacks.filter(
      (pack) => pack.name === curInstanceVersion
    );
    if (!matchingPacks.length) return [];

    let candidateFiles: OtherResourceFileInfo[] = [];
    if (
      resource.type === OtherResourceType.Mod &&
      !resource.tags.includes("datapack")
    ) {
      if (curInstanceModLoader) {
        for (const pack of matchingPacks) {
          const matchingFiles = pack.items.filter(
            (item) =>
              item.loader &&
              item.loader.toLowerCase() === curInstanceModLoader.toLowerCase()
          );
          candidateFiles.push(...matchingFiles);
        }
      }
    } else {
      for (const pack of matchingPacks) {
        candidateFiles.push(...pack.items);
      }
    }

    candidateFiles = candidateFiles.filter(
      (item) => item.releaseType === "beta" || item.releaseType === "release"
    );
    if (!candidateFiles.length) return [];

    candidateFiles.sort(
      (a, b) => new Date(b.fileDate).getTime() - new Date(a.fileDate).getTime()
    );
    return [candidateFiles[0]];
  }, [
    curInstanceVersion,
    versionPacks,
    resource.type,
    resource.tags,
    curInstanceModLoader,
  ]);

  const shouldShowRecommendedSection = (): boolean => {
    const recommendedFiles = getRecommendedFiles;
    if (!recommendedFiles.length) return false;

    const isCorrectVersionFilter =
      selectedVersionLabel === "All" ||
      selectedVersionLabel === curInstanceMajorVersion;

    const isCorrectModLoaderFilter =
      selectedModLoader === "All" || selectedModLoader === curInstanceModLoader;

    return isCorrectVersionFilter && isCorrectModLoaderFilter;
  };

  const fetchVersionLabels = useCallback(() => {
    getGameVersionList().then((list) => {
      if (list && list !== GetStateFlag.Cancelled) {
        const versionList = list
          .filter(
            (version: GameClientResourceInfo) => version.gameType === "release"
          )
          .map((version: GameClientResourceInfo) => version.id);
        setGameVersionList(versionList);
        const majorVersions = [
          ...new Set(
            versionList.map((v) => v.split(".").slice(0, 2).join("."))
          ),
        ];
        setVersionLabels(["All", ...majorVersions]);
      } else {
        setVersionLabels([]);
      }
    });
  }, [getGameVersionList]);

  const handleFetchResourceVersionPacks = useCallback(
    async (
      resourceId: string,
      modLoader: ModLoaderType | "All",
      gameVersions: string[],
      downloadSource: OtherResourceSource
    ) => {
      setIsLoadingVersionPacks(true);
      ResourceService.fetchResourceVersionPacks(
        resourceId,
        modLoader,
        gameVersions,
        downloadSource
      )
        .then((response) => {
          if (response.status === "success") {
            const versionPacks = response.data;
            setVersionPacks(versionPacks);
          } else {
            setVersionPacks([]);
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        })
        .finally(() => {
          setIsLoadingVersionPacks(false);
        });
    },
    [toast]
  );

  const reFetchVersionPacks = useCallback(() => {
    if (!resource.id || !resource.source || !selectedVersionLabel) return;

    handleFetchResourceVersionPacks(
      resource.id,
      selectedModLoader,
      versionLabelToParam(selectedVersionLabel),
      resource.source
    );
  }, [
    resource.id,
    resource.source,
    selectedModLoader,
    selectedVersionLabel,
    handleFetchResourceVersionPacks,
    versionLabelToParam,
  ]);

  const buildModLoaderItem = (modLoader: string) => {
    return modLoader !== "All" ? (
      <HStack spacing={1}>
        <Image
          src={`/images/icons/${modLoader}.png`}
          alt={modLoader}
          boxSize="12px"
        ></Image>
        <Text>
          {modLoader === curInstanceModLoader
            ? `${modLoader} (${t("DownloadSpecificResourceModal.label.currentModLoader")})`
            : modLoader}
        </Text>
      </HStack>
    ) : (
      t("DownloadSpecificResourceModal.label.all")
    );
  };

  const collectItemTags = (items: OtherResourceFileInfo[]) => {
    const tagMap = new Map<string, { raw: string; label: string }>();
    items.forEach((item) => {
      if (!item.loader) return;
      const rawTag = item.loader.trim();
      if (!rawTag) return;
      if (!tagMap.has(rawTag)) {
        tagMap.set(rawTag, { raw: rawTag, label: toCamelCaseLabel(rawTag) });
      }
    });
    return Array.from(tagMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  };

  const renderSection = (
    pack: OtherResourceVersionPack,
    index: number,
    initialIsOpen: boolean = false
  ) => {
    const sectionTags = collectItemTags(pack.items);
    return (
      <Section
        key={index}
        isAccordion
        title={pack.name}
        initialIsOpen={initialIsOpen}
        titleExtra={
            <CountTag count={pack.items.length} />
        }
        headExtra={
          <HStack spacing={2} align="center">
            {sectionTags.length > 0 && (
              <Wrap
                spacing={1}
                shouldWrapChildren
                justify="flex-end"
                maxW={{ base: "42vw", md: "28vw" }}
              >
                {sectionTags.map(({ raw, label }) => (
                  <Tag
                    key={`${pack.name}-${raw}`}
                    colorScheme={getTagColor(raw)}
                    className="tag-xs"
                  >
                    {label}
                  </Tag>
                ))}
              </Wrap>
            )}
          </HStack>
        }
        mb={2}
      >
        {pack.items.length > 0 ? (
          <OptionItemGroup
            items={pack.items.map((item, index) => (
              <OptionItem
                key={index}
                title={item.name}
                description={
                  <HStack
                    fontSize="xs"
                    className="secondary-text"
                    spacing={6}
                    align="flex-start"
                    w="100%"
                  >
                    <HStack spacing={1}>
                      <LuDownload />
                      <Text>{formatDisplayCount(item.downloads)}</Text>
                    </HStack>
                    <HStack spacing={1}>
                      <LuUpload />
                      <Text>{ISOToDate(item.fileDate)}</Text>
                    </HStack>
                    <HStack spacing={1}>
                      <LuPackage />
                      <Text>
                        {t(
                          `DownloadSpecificResourceModal.releaseType.${item.releaseType}`
                        )}
                      </Text>
                    </HStack>
                  </HStack>
                }
                prefixElement={
                  <Avatar
                    src={""}
                    name={item.releaseType}
                    boxSize="32px"
                    borderRadius="4px"
                    backgroundColor={iconBackgroundColor[item.releaseType]}
                  />
                }
                titleExtra={
                  item.loader && (
                    <Tag
                      key={item.loader}
                      colorScheme={primaryColor}
                      className="tag-xs"
                    >
                      {item.loader}
                    </Tag>
                  )
                }
                isFullClickZone
                onClick={() => {
                  if (
                    item.dependencies.length > 0 &&
                    resource.type !== OtherResourceType.ModPack
                  ) {
                    openSharedModal("alert-resource-dependency", {
                      dependencies: item.dependencies,
                      downloadSource: resource.source as OtherResourceSource,
                      curInstanceMajorVersion,
                      curInstanceVersion,
                      curInstanceModLoader,
                      downloadOriginalResource: () =>
                        startDownload(item, resource.translatedName),
                    });
                  } else startDownload(item, resource.translatedName);
                }}
              />
            ))}
          />
        ) : (
          <Empty withIcon={false} size="sm" />
        )}
      </Section>
    );
  };

  useEffect(() => {
    setSelectedModLoader(curInstanceModLoader || "All");
  }, [curInstanceModLoader]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateOrientation = () => {
      setIsPortrait(window.innerWidth < window.innerHeight);
    };
    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    return () => {
      window.removeEventListener("resize", updateOrientation);
    };
  }, []);

  useEffect(() => {
    const initialVersion = curInstanceMajorVersion || "All";
    if (versionLabels.length > 0 && versionLabels.includes(initialVersion)) {
      setSelectedVersionLabel(initialVersion);
    } else {
      setSelectedVersionLabel("All");
    }
  }, [curInstanceMajorVersion, versionLabels]);

  useEffect(() => {
    fetchVersionLabels();
  }, [fetchVersionLabels]);

  useEffect(() => {
    reFetchVersionPacks();
  }, [reFetchVersionPacks]);

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      autoFocus={false}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%" pb={4}>
        <ModalHeader>
          {t("DownloadSpecificResourceModal.title", {
            name:
              showZhTrans && resource.translatedName
                ? `${resource.translatedName} (${resource.name})`
                : resource.name,
            source: resource.source,
          })}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Card
            className={themedStyles.card["card-front"]}
            mt={-2}
            mb={2}
            py={2}
            fontWeight={400}
            display="flex"
            flexDirection={isPortrait ? "column" : "row"}
            alignItems={isPortrait ? "stretch" : "center"}
            gap={isPortrait ? 3 : 4}
          >
            <Box flex="1" minW={0}>
              <OptionItem
                title={
                  showZhTrans && resource.translatedName
                    ? `${resource.translatedName} | ${resource.name}`
                    : resource.name
                }
                titleExtra={
                  translatedTags.length > 0 && (
                    <Wrap
                      spacing={1}
                      justify={isPortrait ? "flex-start" : "flex-end"}
                      shouldWrapChildren
                      maxW="100%"
                    >
                      {visibleTags.map((tag, index) => (
                        <Tag
                          key={`${tag}-${index}`}
                          colorScheme={primaryColor}
                          className="tag-xs"
                        >
                          {tag}
                        </Tag>
                      ))}
                      {hiddenTags.length > 0 && (
                        <Tooltip
                          label={hiddenTags.join(", ")}
                          aria-label="more-tags"
                          hasArrow
                          openDelay={150}
                        >
                          <Tag
                            colorScheme={primaryColor}
                            className="tag-xs"
                            variant="outline"
                            cursor="pointer"
                          >
                            +{hiddenTags.length}
                          </Tag>
                        </Tooltip>
                      )}
                    </Wrap>
                  )
                }
                description={
                  <Text
                    fontSize="xs"
                    className="secondary-text"
                    wordBreak="break-all"
                    whiteSpace="pre-wrap"
                    noOfLines={3}
                    mt={1}
                  >
                    {(showZhTrans && resource.translatedDescription) ||
                      resource.description}
                  </Text>
                }
                prefixElement={
                  <Avatar
                    src={resource.iconSrc}
                    name={resource.name}
                    boxSize="36px"
                    borderRadius="2px"
                  />
                }
                fontWeight={400}
                w="100%"
              />
            </Box>
            {shouldShowResourceLinks && (
              <Stack
                direction={isPortrait ? "row" : "column"}
                spacing={isPortrait ? 3 : 2}
                align={isPortrait ? "flex-start" : "flex-end"}
                flexShrink={0}
              >
                {resource.websiteUrl && (
                  <Link
                    fontSize="xs"
                    color={`${primaryColor}.500`}
                    display="inline-flex"
                    alignItems="center"
                    gap={1}
                    onClick={() => {
                      resource.websiteUrl && openUrl(resource.websiteUrl);
                    }}
                  >
                    <LuExternalLink />
                    {resource.source}
                  </Link>
                )}
                {resource.mcmodId !== 0 && (
                  <Link
                    fontSize="xs"
                    color={`${primaryColor}.500`}
                    display="inline-flex"
                    alignItems="center"
                    gap={1}
                    onClick={() => {
                      resource.mcmodId &&
                        openUrl(
                          `https://www.mcmod.cn/class/${resource.mcmodId}.html`
                        );
                    }}
                  >
                    <LuExternalLink />
                    MCMod
                  </Link>
                )}
              </Stack>
            )}
          </Card>
          <HStack align="center" justify="space-between" mb={3}>
            <MenuSelector
              options={versionLabels.map((item) => ({
                value: item,
                label: buildVersionLabelItem(item),
              }))}
              value={selectedVersionLabel}
              onSelect={(value) => setSelectedVersionLabel(value as string)}
              buttonProps={{ minW: "28" }}
              menuListProps={{ maxH: "40vh", minW: 28, overflow: "auto" }}
            />

            <Box>
              {resource.type === OtherResourceType.Mod &&
                !resource.tags.includes("datapack") && (
                  <NavMenu
                    className="no-scrollbar"
                    selectedKeys={[selectedModLoader]}
                    onClick={setSelectedModLoader}
                    direction="row"
                    size="xs"
                    spacing={2}
                    flex={1}
                    display="flex"
                    items={modLoaderLabels.map((item) => ({
                      value: item,
                      label: buildModLoaderItem(item),
                    }))}
                  />
                )}
            </Box>
          </HStack>
          {isGameVersionListLoading || isVersionPacksLoading ? (
            <VStack mt={8}>
              <BeatLoader size={16} color="gray" />
            </VStack>
          ) : (
            (() => {
              const normalPacks = versionPacks.filter(versionPackFilter);
              const recommendedPacks = shouldShowRecommendedSection()
                ? [
                    {
                      name: t(
                        "DownloadSpecificResourceModal.label.recommendedVersion"
                      ),
                      items: getRecommendedFiles,
                    },
                  ]
                : [];
              const isEmpty =
                normalPacks.length === 0 && !shouldShowRecommendedSection();
              return isEmpty ? (
                <Empty withIcon size="sm" />
              ) : (
                [...recommendedPacks, ...normalPacks].map((pack, index) =>
                  // recommended pack initially open
                  renderSection(
                    pack,
                    index,
                    index === 0 && shouldShowRecommendedSection()
                  )
                )
              );
            })()
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default DownloadSpecificResourceModal;

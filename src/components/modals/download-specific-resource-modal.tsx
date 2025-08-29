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
  Tag,
  Text,
  VStack,
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
import { RuntimeTaskParam, TaskTypeEnums } from "@/models/task";
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
    (taskGroup: string, params: RuntimeTaskParam[]) => {
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

  const startDownload = async (item: OtherResourceFileInfo) => {
    const dir = await getDefaultFilePath();
    const savepath = await save({
      defaultPath: dir + "/" + item.fileName,
    });
    if (!savepath) return;
    handleScheduleProgressiveTaskGroup(resource.type, [
      {
        src: item.downloadUrl,
        dest: savepath,
        sha1: item.sha1,
        type: TaskTypeEnums.Download,
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

  const renderSection = (
    pack: OtherResourceVersionPack,
    index: number,
    initialIsOpen: boolean = false
  ) => {
    return (
      <Section
        key={index}
        isAccordion
        title={pack.name}
        initialIsOpen={initialIsOpen}
        titleExtra={<CountTag count={pack.items.length} />}
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
                  if (item.dependencies.length > 0) {
                    openSharedModal("alert-resource-dependency", {
                      dependencies: item.dependencies,
                      downloadSource: resource.source as OtherResourceSource,
                      curInstanceMajorVersion,
                      curInstanceVersion,
                      curInstanceModLoader,
                      downloadOriginalResource: () => startDownload(item),
                    });
                  } else startDownload(item);
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
            name: resource.translatedName
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
            flexDir="row"
          >
            <OptionItem
              title={
                resource.translatedName
                  ? `${resource.translatedName} | ${resource.name}`
                  : resource.name
              }
              titleExtra={
                <HStack spacing={1}>
                  {resource.tags
                    .filter((t) =>
                      translateTag(t, resource.type, resource.source)
                    )
                    .map((tag) => (
                      <Tag
                        key={tag}
                        colorScheme={primaryColor}
                        className="tag-xs"
                      >
                        {translateTag(tag, resource.type, resource.source)}
                      </Tag>
                    ))}
                </HStack>
              }
              description={
                <Text
                  fontSize="xs"
                  className="secondary-text"
                  wordBreak="break-all"
                  whiteSpace="pre-wrap"
                  mt={1}
                >
                  {resource.description}
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
              flex={1}
            />
            {resource.websiteUrl && (
              <HStack spacing={1}>
                <LuExternalLink />
                <Link
                  fontSize="xs"
                  color={`${primaryColor}.500`}
                  onClick={() => {
                    resource.websiteUrl && openUrl(resource.websiteUrl);
                  }}
                >
                  {resource.source}
                </Link>
              </HStack>
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

import {
  Avatar,
  Box,
  Button,
  Card,
  Grid,
  HStack,
  IconButton,
  Image,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Radio,
  Tag,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { downloadDir, join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuDownload,
  LuExternalLink,
  LuPackage,
  LuRefreshCw,
  LuUpload,
} from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { MenuSelector } from "@/components/common/menu-selector";
import NavMenu from "@/components/common/nav-menu";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import InstancesView from "@/components/instances-view";
import MCVersionNumberHelper from "@/components/mc-version-number-helper";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { InstanceSubdirType, ModLoaderType } from "@/enums/instance";
import { OtherResourceSource, OtherResourceType } from "@/enums/resource";
import { GetStateFlag } from "@/hooks/get-state";
import { InstanceSummary } from "@/models/instance/misc";
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
import cardStyles from "@/styles/card.module.css";
import { ISOToDate } from "@/utils/datetime";
import { translateTag } from "@/utils/resource";
import { formatDisplayCount, sanitizeFileName } from "@/utils/string";

interface DownloadSpecificResourceModalProps extends Omit<
  ModalProps,
  "children"
> {
  resource: OtherResourceInfo;
  curInstanceMajorVersion?: string;
  curInstanceVersion?: string;
  curInstanceModLoader?: ModLoaderType;
}

// Resource version list with single-select; action buttons vary by type.
// regular: [Cancel] [Download] [Install to Instance (popover picker)] [Install to Current Instance (only on instance details pages)]
// modpack: [Cancel] [Download] [Install (download to cache dir then auto-install)]
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
  const primaryColor = config.appearance.theme.primaryColor;
  const showZhTrans =
    config.general.general.language === "zh-Hans" &&
    config.general.functionality.resourceTranslation;
  const addPrefix =
    config.general.general.language === "zh-Hans" &&
    config.general.functionality.translatedFilenamePrefix;

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
  const [selectedItem, setSelectedItem] =
    useState<OtherResourceFileInfo | null>(null);

  const { getGameVersionList, isGameVersionListLoading, getInstanceList } =
    useGlobalData();
  const { openSharedModal, closeSharedModal } = useSharedModals();
  const {
    isOpen: isInstanceSelectorPopoverOpen,
    onOpen: onInstanceSelectorPopoverOpen,
    onClose: onInstanceSelectorPopoverClose,
  } = useDisclosure();

  const routeInstanceId = useMemo(() => {
    const id = router.query.id;
    return Array.isArray(id) ? id[0] : id;
  }, [router.query.id]);

  const isModpack = resource.type === OtherResourceType.ModPack;

  const resourceTypeToDirType = useMemo<Record<string, InstanceSubdirType>>(
    () => ({
      mod: InstanceSubdirType.Mods,
      world: InstanceSubdirType.Saves,
      resourcepack: InstanceSubdirType.ResourcePacks,
      shader: InstanceSubdirType.ShaderPacks,
      datapack: InstanceSubdirType.Saves,
    }),
    []
  );
  const dirType =
    resourceTypeToDirType[resource.type] ?? InstanceSubdirType.Root;

  const modLoaderLabels = [
    "All",
    ModLoaderType.Fabric,
    ModLoaderType.Forge,
    ModLoaderType.NeoForge,
    ModLoaderType.Quilt,
  ];

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

  // add prefix and sanitize
  const getSelectedFileName = useCallback(
    (item: OtherResourceFileInfo) =>
      sanitizeFileName(
        addPrefix && resource.translatedName
          ? `[${resource.translatedName}] ${item.fileName}`
          : item.fileName
      ),
    [addPrefix, resource.translatedName]
  );

  // resource dependencies alert
  const withDependencyCheck = useCallback(
    (action: () => void) => {
      if (!selectedItem) return;
      if (selectedItem.dependencies.length > 0 && !isModpack) {
        openSharedModal("alert-resource-dependency", {
          dependencies: selectedItem.dependencies,
          downloadSource: resource.source as OtherResourceSource,
          curInstanceMajorVersion,
          curInstanceVersion,
          curInstanceModLoader,
          downloadOriginalResource: action,
        });
      } else {
        action();
      }
    },
    [
      selectedItem,
      isModpack,
      resource.source,
      openSharedModal,
      curInstanceMajorVersion,
      curInstanceVersion,
      curInstanceModLoader,
    ]
  );

  // for the "download" button (save dialog), get default download path:
  // on instance page use the instance's subdir
  // modpacks always use system download dir
  const getDefaultDownloadPath = useCallback(async (): Promise<string> => {
    if (!isModpack && routeInstanceId !== undefined) {
      const response = await InstanceService.retrieveInstanceSubdirPath(
        routeInstanceId,
        dirType
      );
      if (response.status === "success") return response.data;
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
    }
    return downloadDir();
  }, [isModpack, routeInstanceId, dirType, toast]);

  const handleDownload = useCallback(() => {
    if (!selectedItem) return;
    withDependencyCheck(async () => {
      const dir = await getDefaultDownloadPath();
      const fileName = getSelectedFileName(selectedItem);
      const savepath = await save({ defaultPath: await join(dir, fileName) });
      if (!savepath) return;
      // use "modpack-wo-install" group to prevent auto-triggering install
      const taskGroup = isModpack ? "modpack-wo-install" : resource.type;
      handleScheduleProgressiveTaskGroup(taskGroup, [
        {
          src: selectedItem.downloadUrl,
          dest: savepath,
          sha1: selectedItem.sha1,
          taskType: TaskTypeEnums.Download,
        },
      ]);
      closeSharedModal("download-specific-resource");
      if (isModpack) closeSharedModal("download-modpack");
      router.push("/downloads");
    });
  }, [
    selectedItem,
    withDependencyCheck,
    getDefaultDownloadPath,
    getSelectedFileName,
    isModpack,
    resource.type,
    handleScheduleProgressiveTaskGroup,
    closeSharedModal,
    router,
  ]);

  const handleInstallToInstance = useCallback(
    async (instance: InstanceSummary) => {
      if (!selectedItem) return;
      const response = await InstanceService.retrieveInstanceSubdirPath(
        instance.id,
        dirType
      );
      if (response.status === "success") {
        const destPath = await join(
          response.data,
          getSelectedFileName(selectedItem)
        );
        handleScheduleProgressiveTaskGroup(resource.type, [
          {
            src: selectedItem.downloadUrl,
            dest: destPath,
            sha1: selectedItem.sha1,
            taskType: TaskTypeEnums.Download,
          },
        ]);
        modalProps.onClose();
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    },
    [
      selectedItem,
      dirType,
      getSelectedFileName,
      resource.type,
      handleScheduleProgressiveTaskGroup,
      modalProps,
      toast,
    ]
  );

  const handleInstallToCurrentInstance = useCallback(() => {
    if (!routeInstanceId) return;
    const instance = getInstanceList()?.find((i) => i.id === routeInstanceId);
    if (instance) handleInstallToInstance(instance);
  }, [routeInstanceId, getInstanceList, handleInstallToInstance]);

  const handleInstallModpack = useCallback(async () => {
    if (!selectedItem) return;
    const cacheDir = config.download.cache.directory.trim();
    if (!cacheDir) return;
    const fileName = sanitizeFileName(selectedItem.fileName);
    const destPath = await join(cacheDir, fileName);
    handleScheduleProgressiveTaskGroup("modpack", [
      {
        src: selectedItem.downloadUrl,
        dest: destPath,
        sha1: selectedItem.sha1,
        taskType: TaskTypeEnums.Download,
      },
    ]);
    closeSharedModal("download-specific-resource");
    closeSharedModal("download-modpack");
    router.push("/downloads");
  }, [
    selectedItem,
    config.download.cache.directory,
    handleScheduleProgressiveTaskGroup,
    closeSharedModal,
    router,
  ]);

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
        downloadSource,
        resource.type
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
    [resource.type, toast]
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
                  <Grid
                    templateColumns="repeat(3, 1fr)"
                    fontSize="xs"
                    className="secondary-text"
                    w={{ base: "sm", lg: "md", xl: "md" }}
                    mt={0.5}
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
                  </Grid>
                }
                prefixElement={
                  <HStack spacing={2.5}>
                    <Radio
                      isChecked={selectedItem === item}
                      onChange={() => setSelectedItem(item)}
                      colorScheme={primaryColor}
                      pointerEvents="none"
                    />
                    <Avatar
                      src={""}
                      name={item.releaseType}
                      boxSize="32px"
                      borderRadius="4px"
                      backgroundColor={iconBackgroundColor[item.releaseType]}
                    />
                  </HStack>
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
                onClick={() => setSelectedItem(item)}
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

  useEffect(() => {
    setSelectedItem(
      modalProps.isOpen ? (getRecommendedFiles[0] ?? null) : null
    );
  }, [modalProps.isOpen, getRecommendedFiles]);

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      autoFocus={false}
      returnFocusOnClose={false}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
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
            className={cardStyles["card-front"]}
            mt={-2}
            mb={2}
            py={2}
            fontWeight={400}
            flexDir="row"
            justify="space-between"
          >
            <OptionItem
              title={
                showZhTrans && resource.translatedName
                  ? `${resource.translatedName} | ${resource.name}`
                  : resource.name
              }
              titleExtra={
                <HStack spacing={1} wrap="wrap">
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
              flex={1}
            />
            <HStack gap={2}>
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
              {resource.mcmodId !== 0 && (
                <HStack spacing={1}>
                  <LuExternalLink />
                  <Link
                    fontSize="xs"
                    color={`${primaryColor}.500`}
                    onClick={() => {
                      resource.mcmodId &&
                        openUrl(
                          `https://www.mcmod.cn/class/${resource.mcmodId}.html`
                        );
                    }}
                  >
                    MCMod
                  </Link>
                </HStack>
              )}
            </HStack>
          </Card>
          <HStack align="center" justify="space-between" mb={3}>
            <HStack>
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
              <MCVersionNumberHelper placement="bottom-start" />
              <IconButton
                aria-label="refresh-version-packs"
                icon={<LuRefreshCw size={14} />}
                size="xs"
                variant="ghost"
                onClick={() => {
                  fetchVersionLabels();
                  reFetchVersionPacks();
                }}
                isDisabled={isGameVersionListLoading || isVersionPacksLoading}
              />
            </HStack>

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
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={modalProps.onClose}>
            {t("DownloadSpecificResourceModal.button.cancel")}
          </Button>
          <Button
            variant="ghost"
            isDisabled={!selectedItem}
            onClick={handleDownload}
          >
            {t("DownloadSpecificResourceModal.button.download")}
          </Button>
          {!isModpack && (
            <Popover
              isOpen={isInstanceSelectorPopoverOpen}
              onClose={onInstanceSelectorPopoverClose}
              placement="top-start"
              gutter={8}
            >
              <PopoverTrigger>
                <Button
                  variant={routeInstanceId ? "ghost" : undefined}
                  colorScheme={routeInstanceId ? undefined : primaryColor}
                  isDisabled={!selectedItem}
                  onClick={() =>
                    withDependencyCheck(onInstanceSelectorPopoverOpen)
                  }
                >
                  {t("DownloadSpecificResourceModal.button.installToInstance")}
                </Button>
              </PopoverTrigger>
              <PopoverContent maxH="xs" overflow="auto">
                <PopoverBody p={0}>
                  <InstancesView
                    instances={getInstanceList() || []}
                    selectedInstance={undefined}
                    viewType="list"
                    withMenu={false}
                    onSelectInstance={(instance) => {
                      onInstanceSelectorPopoverClose();
                      handleInstallToInstance(instance);
                    }}
                  />
                </PopoverBody>
              </PopoverContent>
            </Popover>
          )}
          {isModpack ? (
            <Button
              colorScheme={primaryColor}
              isDisabled={!selectedItem}
              onClick={handleInstallModpack}
            >
              {t("DownloadSpecificResourceModal.button.install")}
            </Button>
          ) : routeInstanceId ? (
            <Button
              colorScheme={primaryColor}
              isDisabled={!selectedItem}
              onClick={() =>
                withDependencyCheck(handleInstallToCurrentInstance)
              }
            >
              {t(
                "DownloadSpecificResourceModal.button.installToCurrentInstance"
              )}
            </Button>
          ) : null}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default DownloadSpecificResourceModal;

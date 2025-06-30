import {
  Avatar,
  Box,
  Button,
  Card,
  HStack,
  Image,
  Link,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
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
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuChevronDown,
  LuDownload,
  LuExternalLink,
  LuPackage,
  LuUpload,
} from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import NavMenu from "@/components/common/nav-menu";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useToast } from "@/contexts/toast";
import { ModLoaderType } from "@/enums/instance";
import {
  modTagList,
  modpackTagList,
  resourcePackTagList,
  shaderPackTagList,
  worldTagList,
} from "@/enums/resource";
import { GetStateFlag } from "@/hooks/get-state";
import { useThemedCSSStyle } from "@/hooks/themed-css";
import {
  GameResourceInfo,
  OtherResourceInfo,
  ResourceVersionPack,
} from "@/models/resource";
import { ResourceService } from "@/services/resource";
import { ISOToDate } from "@/utils/datetime";
import { formatDisplayCount } from "@/utils/string";

interface DownloadSpecificResourceModalProps
  extends Omit<ModalProps, "children"> {
  resource: OtherResourceInfo;
  curInstanceMajorVersion: string | undefined;
  curInstanceModLoader: ModLoaderType | undefined;
}

const DownloadSpecificResourceModal: React.FC<
  DownloadSpecificResourceModalProps
> = ({
  resource,
  curInstanceMajorVersion,
  curInstanceModLoader,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const toast = useToast();
  const themedStyles = useThemedCSSStyle();
  const primaryColor = config.appearance.theme.primaryColor;

  const modLoaderLabels = [
    "All",
    ModLoaderType.Fabric,
    ModLoaderType.Forge,
    ModLoaderType.NeoForge,
  ];
  const [gameVersionList, setGameVersionList] = useState<string[]>([]);
  const [versionLabels, setVersionLabels] = useState<string[]>([]);
  const [selectedVersionLabel, setSelectedVersionLabel] =
    useState<string>("All");
  const [selectedModLoader, setSelectedModLoader] = useState<
    ModLoaderType | "All"
  >("All");
  const [isVersionPacksLoading, setIsLoadingVersionPacks] =
    useState<boolean>(true);
  const [versionPacks, setVersionPacks] = useState<ResourceVersionPack[]>([]);

  const { getGameVersionList, isGameVersionListLoading } = useGlobalData();

  const tagLists: Record<string, any> = {
    mod: modTagList,
    world: worldTagList,
    resourcepack: resourcePackTagList,
    shader: shaderPackTagList,
  };

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
        allTags = Object.values(tagList).flat() as string[];
      }
      if (!allTags.includes(tag)) return tag;
      return t(
        `ResourceDownloader.${resourceType}TagList.${downloadSource}.${tag}`
      );
    }
    return tag;
  };

  const versionLabelToParam = useCallback(
    (label: string) => {
      if (label === "All") return ["All"];
      if (resource.source === "Modrinth")
        return gameVersionList.filter((version) => version.startsWith(label));
      return [label];
    },
    [gameVersionList, resource.source]
  );

  const iconBackgroundColor = (releaseType: string) => {
    switch (releaseType) {
      case "alpha":
        return "yellow.300";
      case "beta":
        return "purple.500";
      case "release":
        return "green.500";
    }
  };

  const matchVersion = (majorVersion: string, version: string) => {
    const versionPattern = new RegExp(`^${majorVersion}(\\.|$)`);
    return versionPattern.test(version);
  };

  const fetchVersionLabels = useCallback(() => {
    getGameVersionList().then((list) => {
      if (list && list !== GetStateFlag.Cancelled) {
        const versionList = list
          .filter((version: GameResourceInfo) => version.gameType === "release")
          .map((version: GameResourceInfo) => version.id);
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
      downloadSource: string
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
    if (!resource.id || !resource.source) return;

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

  const buildVersionLabelItem = (version: string) => {
    return version !== "All"
      ? version === curInstanceMajorVersion
        ? `${version} (${t("DownloadSpecificResourceModal.label.recommendedVersion")})`
        : version
      : t("DownloadSpecificResourceModal.label.all");
  };

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

  useEffect(() => {
    setSelectedModLoader(curInstanceModLoader || "All");
    setSelectedVersionLabel(curInstanceMajorVersion || "All");
  }, [curInstanceModLoader, curInstanceMajorVersion]);

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
          })}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Card
            className={themedStyles.card["card-front"]}
            mb={3}
            fontWeight={400}
          >
            <OptionItem
              title={
                resource.translatedName
                  ? `${resource.translatedName}｜${resource.name}`
                  : resource.name
              }
              titleExtra={
                <HStack spacing={1}>
                  {resource.tags.map((tag) => (
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
                  boxSize="48px"
                  borderRadius="4px"
                />
              }
              fontWeight={400}
            />
            <HStack mt={1.5}>
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
            </HStack>
          </Card>
          <HStack align="center" justify="space-between" mb={3}>
            <Menu>
              <MenuButton
                as={Button}
                size="xs"
                w={36}
                variant="outline"
                fontSize="xs"
                textAlign="center"
                rightIcon={<LuChevronDown />}
              >
                <Text className="ellipsis-text" maxW={36}>
                  {buildVersionLabelItem(selectedVersionLabel)}
                </Text>
              </MenuButton>
              <MenuList maxH="40vh" minW={36} overflow="auto">
                <MenuOptionGroup
                  value={selectedVersionLabel}
                  type="radio"
                  onChange={(value) => {
                    setSelectedVersionLabel(value as string);
                  }}
                >
                  {versionLabels.map((item, key) => (
                    <MenuItemOption key={key} value={item} fontSize="xs">
                      {buildVersionLabelItem(item)}
                    </MenuItemOption>
                  ))}
                </MenuOptionGroup>
              </MenuList>
            </Menu>
            <Box>
              {resource.type === "mod" && (
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
          ) : versionPacks.length > 0 ? (
            versionPacks
              .filter(
                (v) =>
                  selectedVersionLabel === "All" ||
                  matchVersion(
                    selectedVersionLabel,
                    v.name.split(" ").pop() || ""
                  )
              )
              .map((pack, index) => (
                <Section
                  key={index}
                  isAccordion
                  title={pack.name}
                  initialIsOpen={false}
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
                                <Text>
                                  {formatDisplayCount(item.downloads)}
                                </Text>
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
                              backgroundColor={iconBackgroundColor(
                                item.releaseType
                              )}
                            />
                          }
                          isFullClickZone
                          onClick={() => {
                            console.log("Downloading", item.fileName);
                            console.log(item.downloadUrl); // TBD
                          }}
                        />
                      ))}
                    />
                  ) : (
                    <Empty withIcon={false} size="sm" />
                  )}
                </Section>
              ))
          ) : (
            <Empty withIcon size="sm" />
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default DownloadSpecificResourceModal;

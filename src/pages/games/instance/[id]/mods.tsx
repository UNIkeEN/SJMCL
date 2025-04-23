import {
  Avatar,
  AvatarBadge,
  Box,
  Card,
  Divider,
  HStack,
  Highlight,
  Icon,
  Input,
  Tag,
  Text,
} from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCircleCheck,
  LuCircleMinus,
  LuClockArrowUp,
  LuSearch,
  LuTriangleAlert,
  LuX,
} from "react-icons/lu";
import { AutoSizer, List } from "react-virtualized";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import ModLoaderCards from "@/components/mod-loader-cards";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { InstanceSubdirEnums, ModLoaderEnums } from "@/enums/instance";
import { InstanceError } from "@/enums/service-error";
import { useThemedCSSStyle } from "@/hooks/themed-css";
import { LocalModInfo } from "@/models/instance/misc";
import { InstanceService } from "@/services/instance";
import { base64ImgSrc } from "@/utils/string";

const InstanceModsPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const {
    summary,
    handleOpenInstanceSubdir,
    handleImportResource,
    getLocalModList,
  } = useInstanceSharedData();
  const { config, update } = useLauncherConfig();
  const { openSharedModal } = useSharedModals();
  const primaryColor = config.appearance.theme.primaryColor;
  const accordionStates = config.states.instanceModsPage.accordionStates;
  const themedStyles = useThemedCSSStyle();

  const [localMods, setLocalMods] = useState<LocalModInfo[]>([]);
  const [filteredMods, setFilteredMods] = useState<LocalModInfo[]>([]);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const [listHeight, setListHeight] = useState(360);

  useEffect(() => {
    setLocalMods(getLocalModList() || []);
  }, [getLocalModList]);

  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const modListRef = useRef<HTMLDivElement>(null);

  const calculateListHeight = useCallback(() => {
    if (modListRef.current) {
      const rect = modListRef.current.getBoundingClientRect();
      const y = rect.top + window.scrollY;
      const newHeight = Math.min(
        window.innerHeight - y - 90,
        filteredMods.length * 50
      );
      setListHeight(newHeight);
    }
  }, [filteredMods.length]);

  useEffect(() => {
    calculateListHeight();
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(calculateListHeight);
    });
    if (modListRef.current) {
      resizeObserver.observe(modListRef.current);
    }

    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(calculateListHeight);
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [calculateListHeight]);

  useEffect(() => {
    const keywords = query.trim().toLowerCase().split(/\s+/);
    if (keywords.length === 0 || keywords[0] === "") {
      setFilteredMods(localMods);
    } else {
      const filtered = localMods.filter((mod) => {
        const name = mod.name?.toLowerCase() || "";
        const fileName = mod.fileName?.toLowerCase() || "";
        return keywords.some(
          (kw) => name.includes(kw) || fileName.includes(kw)
        );
      });

      setFilteredMods(filtered);
    }
  }, [query, localMods]);

  useEffect(() => {
    if (isSearching) searchInputRef.current?.focus();
  }, [isSearching]);

  const handleClearSearch = () => {
    setQuery("");
    setIsSearching(false);
  };

  const handleToggleModByExtension = useCallback(
    (filePath: string, enable: boolean) => {
      InstanceService.toggleModByExtension(filePath, enable).then(
        (response) => {
          if (response.status === "success") {
            setLocalMods((prevMods) =>
              prevMods.map((prev) => {
                if (prev.filePath === filePath) {
                  let newFilePath = prev.filePath;
                  if (enable && newFilePath.endsWith(".disabled")) {
                    newFilePath = newFilePath.slice(0, -9);
                  }
                  if (!enable && !newFilePath.endsWith(".disabled")) {
                    newFilePath = newFilePath + ".disabled";
                  }

                  return {
                    ...prev,
                    filePath: newFilePath,
                    enabled: enable,
                  };
                }
                return prev;
              })
            );
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
            if (response.raw_error === InstanceError.FileNotFoundError) {
              setLocalMods(getLocalModList(true) || []);
            }
          }
        }
      );
    },
    [toast, getLocalModList]
  );

  const modSecMenuOperations = [
    {
      icon: "openFolder",
      onClick: () => {
        handleOpenInstanceSubdir(InstanceSubdirEnums.Mods);
      },
    },
    {
      icon: "add",
      onClick: () => {
        handleImportResource({
          filterName: t("InstanceLayout.instanceTabList.mods"),
          filterExt: ["zip", "jar", "disabled"],
          tgtDirType: InstanceSubdirEnums.Mods,
          decompress: false,
          onSuccessCallback: () => {
            setLocalMods(getLocalModList(true) || []);
          },
        });
      },
    },
    {
      icon: "download",
      onClick: () => {
        openSharedModal("download-resource", {
          initialResourceType: "mod",
        });
      },
    },
    {
      icon: LuClockArrowUp,
      label: t("InstanceModsPage.modList.menu.update"),
      onClick: () => {},
    },
    {
      icon: "refresh",
      onClick: () => {
        setLocalMods(getLocalModList(true) || []);
      },
    },
  ];

  const modItemMenuOperations = (mod: LocalModInfo) => [
    ...(mod.potentialIncompatibility
      ? [
          {
            label: t("InstanceModsPage.modList.menu.alert"),
            icon: LuTriangleAlert,
            danger: true,
            onClick: () => {},
          },
        ]
      : []),
    {
      label: t(mod.enabled ? "General.disable" : "General.enable"),
      icon: mod.enabled ? LuCircleMinus : LuCircleCheck,
      danger: false,
      onClick: () => {
        handleToggleModByExtension(mod.filePath, !mod.enabled);
      },
    },
    {
      label: "",
      icon: "revealFile", // use common-icon-button predefined icon
      danger: false,
      onClick: () => {
        revealItemInDir(mod.filePath);
      },
    },
    {
      label: t("InstanceModsPage.modList.menu.info"),
      icon: "info",
      danger: false,
      onClick: () => {},
    },
  ];

  const rowRenderer = ({ index, key, style }: any) => {
    const mod = filteredMods[index];
    return (
      <Box key={key} style={style}>
        <OptionItem
          childrenOnHover
          title={
            <Text fontSize="xs-sm" className="no-select">
              <Highlight
                query={query.trim().toLowerCase().split(/\s+/)}
                styles={{ bg: "yellow.200" }}
              >
                {mod.translatedName
                  ? `${mod.translatedName}｜${mod.name}`
                  : mod.name || mod.fileName}
              </Highlight>
            </Text>
          }
          titleExtra={
            <HStack>
              {mod.version && (
                <Text fontSize="xs" className="secondary-text no-select">
                  {mod.version}
                </Text>
              )}
              {mod.loaderType !== ModLoaderEnums.Unknown && (
                <Tag colorScheme={primaryColor} className="tag-xs">
                  {mod.loaderType}
                </Tag>
              )}
            </HStack>
          }
          description={
            <Text
              fontSize="xs"
              overflow="hidden"
              className="secondary-text no-select ellipsis-text"
            >
              <Highlight
                query={query.trim().toLowerCase().split(/\s+/)}
                styles={{ bg: "yellow.200" }}
              >
                {mod.fileName}
              </Highlight>
              {mod.description ? `: ${mod.description}` : ""}
            </Text>
          }
          prefixElement={
            <Avatar
              src={base64ImgSrc(mod.iconSrc)}
              name={mod.name || mod.fileName}
              boxSize="28px"
              borderRadius="4px"
              style={{
                filter: mod.enabled ? "none" : "grayscale(90%)",
                opacity: mod.enabled ? 1 : 0.5,
              }}
            >
              <AvatarBadge
                bg={
                  mod.enabled
                    ? mod.potentialIncompatibility
                      ? "orange"
                      : "green"
                    : "black"
                }
                boxSize="0.75em"
                borderWidth={2}
              />
            </Avatar>
          }
        >
          <HStack spacing={0}>
            {modItemMenuOperations(mod).map((item, index) => (
              <CommonIconButton
                key={index}
                icon={item.icon}
                label={item.label}
                colorScheme={item.danger ? "red" : "gray"}
                onClick={item.onClick}
              />
            ))}
          </HStack>
        </OptionItem>
        {index < filteredMods.length - 1 && <Divider my={2} />}
      </Box>
    );
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      height={windowHeight - 169}
      overflow="hidden"
      gap={2}
    >
      <Section
        title={t("InstanceModsPage.modLoaderList.title")}
        isAccordion
        initialIsOpen={accordionStates[0]}
        onAccordionToggle={(isOpen) => {
          update(
            "states.instanceModsPage.accordionStates",
            accordionStates.toSpliced(0, 1, isOpen)
          );
        }}
      >
        <ModLoaderCards
          currentType={summary?.modLoader.loaderType || "Unknown"}
          currentVersion={summary?.modLoader.version}
          displayMode="entry"
        />
      </Section>

      <Box ref={modListRef}></Box>

      <Section
        title={t("InstanceModsPage.modList.title")}
        isAccordion
        initialIsOpen={accordionStates[1]}
        titleExtra={
          <CountTag
            count={`${query.trim() ? `${filteredMods.length} / ` : ""}${localMods.length}`}
          />
        }
        onAccordionToggle={(isOpen) => {
          update(
            "states.instanceModsPage.accordionStates",
            accordionStates.toSpliced(1, 1, isOpen)
          );
        }}
        headExtra={
          <HStack spacing={2}>
            {modSecMenuOperations.map((btn, index) => (
              <CommonIconButton
                key={index}
                icon={btn.icon}
                label={btn.label}
                onClick={btn.onClick}
                size="xs"
                fontSize="sm"
                h={21}
              />
            ))}

            {isSearching ? (
              <HStack>
                <Input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  size="xs"
                  w={140}
                  fontSize="sm"
                  placeholder={t("InstanceModsPage.modList.menu.placeholder")}
                  focusBorderColor={`${primaryColor}.500`}
                />
                <CommonIconButton
                  icon={LuX}
                  onClick={handleClearSearch}
                  size="xs"
                  fontSize="sm"
                  label={t("General.cancel")}
                />
              </HStack>
            ) : (
              <CommonIconButton
                icon={LuSearch}
                onClick={() => setIsSearching(true)}
                size="xs"
                fontSize="sm"
                label={t("InstanceModsPage.modList.menu.search")}
              />
            )}
          </HStack>
        }
      >
        {summary?.modLoader.loaderType === ModLoaderEnums.Unknown &&
          filteredMods.length > 0 && (
            <HStack fontSize="xs" color="red.600" mt={-0.5} ml={1.5} mb={2}>
              <Icon as={LuTriangleAlert} />
              <Text>{t("InstanceModsPage.modList.warning")}</Text>
            </HStack>
          )}
        {filteredMods.length > 0 ? (
          <Card className={themedStyles.card["card-front"]} h="100%">
            <Box flex="1" overflowY="auto" overflowX="hidden">
              <AutoSizer disableHeight>
                {({ width }) => (
                  <List
                    width={width}
                    height={listHeight}
                    rowCount={filteredMods.length}
                    rowHeight={50}
                    rowRenderer={rowRenderer}
                  />
                )}
              </AutoSizer>
            </Box>
          </Card>
        ) : (
          <Empty withIcon={false} size="sm" />
        )}
      </Section>
    </Box>
  );
};

export default InstanceModsPage;

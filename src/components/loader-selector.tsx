import {
  Center,
  HStack,
  Image,
  Radio,
  RadioGroup,
  Tag,
  VStack,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BeatLoader } from "react-spinners";
import Empty from "@/components/common/empty";
import {
  OptionItemProps,
  VirtualOptionItemGroup,
} from "@/components/common/option-item-virtual";
import { Section } from "@/components/common/section";
import SelectableCard, {
  SelectableCardProps,
} from "@/components/common/selectable-card";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { ModLoaderType } from "@/enums/instance";
import {
  GameClientResourceInfo,
  ModLoaderResourceInfo,
  OptiFineResourceInfo,
  defaultModLoaderResourceInfo,
} from "@/models/resource";
import { ResourceService } from "@/services/resource";
import { ISOToDatetime } from "@/utils/datetime";

export const modLoaderTypes: ModLoaderType[] = [
  ModLoaderType.Forge,
  ModLoaderType.Fabric,
  ModLoaderType.NeoForge,
];

export const modLoaderTypesToIcon: Record<string, string> = {
  Unknown: "",
  Fabric: "Fabric.png",
  Forge: "Forge.png",
  NeoForge: "NeoForge.png",
};

interface LoaderSelectorProps {
  selectedGameVersion: GameClientResourceInfo;
  selectedModLoader: ModLoaderResourceInfo;
  onSelectModLoader: (v: ModLoaderResourceInfo) => void;
  selectedOptiFine?: OptiFineResourceInfo | undefined;
  onSelectOptiFine?: (v: OptiFineResourceInfo | undefined) => void;
}

export const LoaderSelector: React.FC<LoaderSelectorProps> = ({
  selectedGameVersion,
  selectedModLoader,
  onSelectModLoader,
  selectedOptiFine,
  onSelectOptiFine,
  ...props
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const toast = useToast();
  const primaryColor = config.appearance.theme.primaryColor;
  const [versionList, setVersionList] = useState<OptionItemProps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<ModLoaderType | "OptiFine">(
    ModLoaderType.Unknown
  );
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (selectedOptiFine) {
      setSelectedType("OptiFine");
      setSelectedId(selectedOptiFine ? selectedOptiFine.filename : "");
    } else {
      setSelectedType(selectedModLoader.loaderType);
      setSelectedId(selectedModLoader.version);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModLoader.loaderType]);

  function isModLoaderResourceInfo(
    version: ModLoaderResourceInfo | OptiFineResourceInfo
  ): version is ModLoaderResourceInfo {
    return (version as ModLoaderResourceInfo).loaderType !== undefined;
  }

  const buildOptionItems = useCallback(
    (
      version: ModLoaderResourceInfo | OptiFineResourceInfo
    ): OptionItemProps => {
      let title = isModLoaderResourceInfo(version)
        ? version.version
        : version?.filename;
      return {
        title,
        description: isModLoaderResourceInfo(version) && version.description,
        prefixElement: (
          <HStack spacing={2.5}>
            <Radio value={title} colorScheme={primaryColor} />
            <Image
              src={`/images/icons/${isModLoaderResourceInfo(version) ? modLoaderTypesToIcon[version.loaderType] : "OptiFine.png"}`}
              alt={title}
              boxSize="28px"
              borderRadius="4px"
            />
          </HStack>
        ),
        titleExtra: (
          <Tag colorScheme={primaryColor} className="tag-xs">
            {t(
              `LoaderSelector.${(isModLoaderResourceInfo(version) ? version.stable : !version.patch.startsWith("pre")) ? "stable" : "beta"}`
            )}
          </Tag>
        ),
        children: <></>,
        isFullClickZone: true,
        onClick: () => {
          if (isModLoaderResourceInfo(version)) {
            onSelectModLoader(version);
          } else {
            onSelectOptiFine?.(version);
          }
          setSelectedId(title);
        },
      };
    },
    [primaryColor, t, onSelectModLoader, onSelectOptiFine]
  );

  const handleFetchModLoaderVersionList = useCallback(
    (type: ModLoaderType) => {
      setIsLoading(true);
      ResourceService.fetchModLoaderVersionList(selectedGameVersion.id, type)
        .then((res) => {
          if (res.status === "success") {
            setVersionList(
              res.data
                .map((loader) => ({
                  ...loader,
                  description:
                    loader.description &&
                    t("LoaderSelector.releaseDate", {
                      date: ISOToDatetime(loader.description),
                    }),
                }))
                .map(buildOptionItems)
            );
          } else {
            setVersionList([]);
            toast({
              status: "error",
              title: res.message,
              description: res.details,
            });
          }
        })
        .finally(() => setIsLoading(false));
    },
    [selectedGameVersion.id, buildOptionItems, t, toast]
  );

  const handleFetchOptiFineVersionList = useCallback(() => {
    setIsLoading(true);
    ResourceService.fetchOptiFineVersionList(selectedGameVersion.id)
      .then((res) => {
        if (res.status === "success") {
          setVersionList(res.data.map(buildOptionItems));
        } else {
          setVersionList([]);
          toast({
            status: "error",
            title: res.message,
            description: res.details,
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, [selectedGameVersion.id, buildOptionItems, toast]);

  let selectableCardItems = modLoaderTypes.map(
    (type): SelectableCardProps => ({
      title: type,
      iconSrc: `/images/icons/${modLoaderTypesToIcon[type]}`,
      description:
        selectedModLoader.loaderType !== ModLoaderType.Unknown
          ? selectedModLoader.loaderType === type
            ? selectedModLoader.version || t("LoaderSelector.noVersionSelected")
            : t("LoaderSelector.notCompatibleWith", {
                item: selectedModLoader.loaderType,
              })
          : t("LoaderSelector.noVersionSelected"),
      displayMode: "selector",
      isLoading,
      isSelected: type === selectedModLoader.loaderType,
      isChevronShown: selectedType !== type,
      onSelect: () => {
        setSelectedType(type);
        if (selectedModLoader.loaderType !== type) {
          onSelectModLoader({
            loaderType: type,
            version: "",
            description: "",
            stable: false,
          });
          setSelectedId("");
        } else {
          setSelectedId(selectedModLoader.version);
        }
        if (
          type !== ModLoaderType.Forge ||
          (selectedOptiFine && !selectedOptiFine.filename)
        ) {
          // When OptiFine is not compatible with the selected mod loader, or selected without a version, clear it
          onSelectOptiFine?.(undefined);
        }
      },
      onCancel: () => {
        if (selectedType === type) {
          setSelectedType(ModLoaderType.Unknown);
          setSelectedId("");
        }
        onSelectModLoader(defaultModLoaderResourceInfo);
      },
    })
  );

  if (typeof onSelectOptiFine === "function") {
    selectableCardItems.push({
      title: "OptiFine",
      iconSrc: "/images/icons/OptiFine.png",
      description: selectedOptiFine
        ? selectedOptiFine.type + " " + selectedOptiFine.patch
        : selectedModLoader.loaderType === ModLoaderType.Forge ||
            selectedModLoader.loaderType === ModLoaderType.Unknown
          ? t("LoaderSelector.noVersionSelected")
          : t("LoaderSelector.notCompatibleWith", {
              item: selectedModLoader.loaderType,
            }),
      displayMode: "selector",
      isLoading,
      isSelected: !!selectedOptiFine,
      isDisabled: !(
        selectedModLoader.loaderType === ModLoaderType.Forge ||
        selectedModLoader.loaderType === ModLoaderType.Unknown
      ),
      isChevronShown: selectedType !== "OptiFine",
      onSelect: () => {
        setSelectedType("OptiFine");
        if (!selectedOptiFine) {
          onSelectOptiFine?.({
            filename: "",
            patch: "",
            type: "",
          });
          setSelectedId("");
        } else {
          setSelectedId(selectedOptiFine.filename);
        }

        if (
          selectedModLoader.loaderType !== ModLoaderType.Unknown &&
          !selectedModLoader.version
        ) {
          // When some mod loader was selected without a version, clear it
          onSelectModLoader(defaultModLoaderResourceInfo);
        }
      },
      onCancel: () => {
        if (selectedType === "OptiFine") {
          setSelectedType(ModLoaderType.Unknown);
          setSelectedId("");
        }
        onSelectOptiFine?.(undefined);
      },
    });
  }

  useEffect(() => {
    if (selectedType === "OptiFine") {
      handleFetchOptiFineVersionList();
    } else if (selectedType !== ModLoaderType.Unknown) {
      handleFetchModLoaderVersionList(selectedType);
    } else {
      setVersionList([]);
    }
  }, [
    handleFetchModLoaderVersionList,
    handleFetchOptiFineVersionList,
    selectedType,
  ]);

  return (
    <HStack {...props} w="100%" h="100%" spacing={4} overflow="hidden">
      <VStack
        spacing={3.5}
        h="100%"
        overflowY="auto"
        overflowX="hidden"
        flexShrink={0}
      >
        {selectableCardItems.map((item, index) => (
          <SelectableCard key={index} {...item} minW="3xs" w="100%" />
        ))}
      </VStack>
      <Section overflow="auto" flexGrow={1} w="100%" h="100%">
        {isLoading ? (
          <Center h="100%">
            <BeatLoader size={16} color="gray" />
          </Center>
        ) : versionList.length === 0 ? (
          <Center h="100%">
            <Empty withIcon={false} size="sm" />
          </Center>
        ) : (
          <RadioGroup value={selectedId} onChange={setSelectedId} h="100%">
            <VirtualOptionItemGroup h="100%" items={versionList} />
          </RadioGroup>
        )}
      </Section>
    </HStack>
  );
};

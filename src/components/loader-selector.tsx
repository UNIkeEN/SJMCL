import {
  Center,
  HStack,
  Image,
  Radio,
  RadioGroup,
  Tag,
  VStack,
} from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
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

export type LoaderSelectorMode = "modloader" | "optifine" | "all";

export const modLoaderTypes: ModLoaderType[] = [
  ModLoaderType.Forge,
  ModLoaderType.Fabric,
  ModLoaderType.NeoForge,
  ModLoaderType.Quilt,
];

export const modLoaderTypesToIcon: Record<string, string> = {
  Unknown: "",
  Fabric: "Fabric.png",
  Forge: "Forge.png",
  NeoForge: "NeoForge.png",
  Quilt: "Quilt.png",
};

interface LoaderSelectorProps {
  mode?: LoaderSelectorMode;
  selectedGameVersion: GameClientResourceInfo;
  selectedModLoader: ModLoaderResourceInfo;
  onSelectModLoader: (v: ModLoaderResourceInfo) => void;
  selectedOptiFine?: OptiFineResourceInfo | undefined;
  onSelectOptiFine?: (v: OptiFineResourceInfo | undefined) => void;
}

export const LoaderSelector: React.FC<LoaderSelectorProps> = ({
  mode = "all",
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
    mode === "optifine" ? "OptiFine" : ModLoaderType.Unknown
  );
  const [selectedId, setSelectedId] = useState("");

  const selectableCardListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === "optifine") return;

    if (
      selectedModLoader.loaderType !== ModLoaderType.Unknown &&
      selectedType !== selectedModLoader.loaderType
    ) {
      setSelectedType(selectedModLoader.loaderType);
    }
  }, [selectedModLoader.loaderType, selectedType, mode]);

  function isModLoaderResourceInfo(
    version: ModLoaderResourceInfo | OptiFineResourceInfo
  ): version is ModLoaderResourceInfo {
    return (version as ModLoaderResourceInfo).loaderType !== undefined;
  }

  const buildOptionItems = useCallback(
    (
      version: ModLoaderResourceInfo | OptiFineResourceInfo
    ): OptionItemProps => {
      const title = isModLoaderResourceInfo(version)
        ? version.version
        : version.filename;

      return {
        title,
        description: isModLoaderResourceInfo(version) && version.description,
        prefixElement: (
          <HStack spacing={2.5}>
            <Radio value={title} colorScheme={primaryColor} />
            <Image
              src={`/images/icons/${
                isModLoaderResourceInfo(version)
                  ? modLoaderTypesToIcon[version.loaderType]
                  : "OptiFine.png"
              }`}
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
        isFullClickZone: true,
        onClick: () => {
          if (isModLoaderResourceInfo(version)) {
            onSelectModLoader(version);
          } else {
            onSelectOptiFine?.(version);
          }
          setSelectedId(title);
        },
        children: <></>,
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

  useEffect(() => {
    if (mode === "optifine") {
      setSelectedId(selectedOptiFine?.filename || "");
      return;
    }

    if (selectedOptiFine) {
      setSelectedId(selectedOptiFine.filename);
    } else {
      setSelectedId(selectedModLoader.version);
    }
  }, [selectedModLoader, selectedOptiFine, mode]);

  useEffect(() => {
    if (mode === "optifine") {
      setSelectedType("OptiFine");
    } else if (mode === "modloader") {
      if (selectedType === "OptiFine") {
        setSelectedType(ModLoaderType.Unknown);
      }
    }
  }, [selectedType, mode]);

  useEffect(() => {
    if (mode === "optifine") {
      handleFetchOptiFineVersionList();
      return;
    }

    if (selectedType === "OptiFine") {
      handleFetchOptiFineVersionList();
    } else if (selectedType !== ModLoaderType.Unknown) {
      handleFetchModLoaderVersionList(selectedType);
    } else {
      setVersionList([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, mode]);

  let selectableCardItems: SelectableCardProps[] = [];

  if (mode !== "optifine") {
    selectableCardItems.push(
      ...modLoaderTypes.map((type) => ({
        title: type,
        iconSrc: `/images/icons/${modLoaderTypesToIcon[type]}`,
        description:
          selectedModLoader.loaderType === type
            ? selectedModLoader.version || t("LoaderSelector.noVersionSelected")
            : t("LoaderSelector.noVersionSelected"),
        displayMode: "selector" as const,
        isLoading,
        isSelected: type === selectedModLoader.loaderType,
        isChevronShown: selectedType !== type,
        onSelect: () => {
          setSelectedType(type);
          onSelectModLoader({
            loaderType: type,
            version: "",
            description: "",
            stable: false,
          });
          setSelectedId("");
          onSelectOptiFine?.(undefined);
        },
        onCancel: () => {
          setSelectedType(ModLoaderType.Unknown);
          setSelectedId("");
          onSelectModLoader(defaultModLoaderResourceInfo);
        },
      }))
    );
  }

  if (mode !== "modloader" && onSelectOptiFine) {
    selectableCardItems.push({
      title: "OptiFine",
      iconSrc: "/images/icons/OptiFine.png",
      description: selectedOptiFine
        ? selectedOptiFine.type + " " + selectedOptiFine.patch
        : t("LoaderSelector.noVersionSelected"),
      displayMode: "selector",
      isLoading,
      isSelected: !!selectedOptiFine,
      isChevronShown: selectedType !== "OptiFine",
      onSelect: () => {
        setSelectedType("OptiFine");
        onSelectOptiFine({
          filename: "",
          patch: "",
          type: "",
        });
        setSelectedId("");
      },
      onCancel: () => {
        setSelectedType(ModLoaderType.Unknown);
        setSelectedId("");
        onSelectOptiFine(undefined);
      },
    });
  }

  useEffect(() => {
    const list = selectableCardListRef.current;
    if (!list) return;
    const selectedCard = list.querySelector<HTMLElement>(
      '[data-loader-selected="true"]'
    );
    if (!selectedCard) return;

    const frame = requestAnimationFrame(() => {
      selectedCard.scrollIntoView({
        block: "nearest",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [selectedType, selectedOptiFine, selectedModLoader]);

  return (
    <HStack {...props} w="100%" h="100%" spacing={4} overflow="hidden">
      {mode !== "optifine" && (
        <VStack
          spacing={3.5}
          h="100%"
          overflowY="auto"
          overflowX="hidden"
          flexShrink={0}
          ref={selectableCardListRef}
        >
          {selectableCardItems.map((item, index) => (
            <SelectableCard
              key={index}
              {...item}
              minW="3xs"
              w="100%"
              data-loader-selected={item.isSelected ? "true" : undefined}
            />
          ))}
        </VStack>
      )}
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

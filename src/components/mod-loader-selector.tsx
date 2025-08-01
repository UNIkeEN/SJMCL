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
import ModLoaderCards from "@/components/mod-loader-cards";
import { useLauncherConfig } from "@/contexts/config";
import {
  GameResourceInfo,
  ModLoaderResourceInfo,
  defaultModLoaderResourceInfo,
} from "@/models/resource";
import { ResourceService } from "@/services/resource";
import { ISOToDatetime } from "@/utils/datetime";

const modLoaderTypesToIcon: Record<string, string> = {
  Unknown: "",
  Fabric: "Fabric.png",
  Forge: "Forge.png",
  NeoForge: "NeoForge.png",
};

interface ModLoaderSelectorProps {
  selectedGameVersion: GameResourceInfo;
  selectedModLoader: ModLoaderResourceInfo;
  onSelectModLoader: (v: ModLoaderResourceInfo) => void;
}

export const ModLoaderSelector: React.FC<ModLoaderSelectorProps> = ({
  selectedGameVersion,
  selectedModLoader,
  onSelectModLoader,
  ...props
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const [modLoaders, setModLoaders] = useState<ModLoaderResourceInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const expandedLoaderType =
    selectedModLoader.loaderType !== "Unknown"
      ? selectedModLoader.loaderType
      : null;

  useEffect(() => {
    setLoading(true);
    ResourceService.fetchModLoaderVersionList(
      selectedGameVersion.id,
      selectedModLoader.loaderType
    )
      .then((res) => {
        if (res.status === "success") {
          setModLoaders(
            res.data.map((loader) => ({
              ...loader,
              description:
                loader.description &&
                t("ModLoaderSelector.releaseDate", {
                  date: ISOToDatetime(loader.description),
                }),
            }))
          );
        } else {
          console.log(res.raw_error);
          setModLoaders([]);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedGameVersion.id, selectedModLoader.loaderType, t]);

  const onSelectModLoaderVersion = useCallback(
    (version: string) => {
      if (version === selectedModLoader.version) {
        onSelectModLoader(defaultModLoaderResourceInfo);
      } else {
        let _modLoader = modLoaders.filter(
          (loader) => loader.version === version
        )[0];
        onSelectModLoader(_modLoader);
      }
    },
    [modLoaders, onSelectModLoader, selectedModLoader.version]
  );

  const buildOptionItems = useCallback(
    (version: ModLoaderResourceInfo): OptionItemProps => ({
      title: version.version,
      description: version.description,
      prefixElement: (
        <HStack spacing={2.5}>
          <Radio value={version.version} colorScheme={primaryColor} />
          <Image
            src={`/images/icons/${modLoaderTypesToIcon[version.loaderType]}`}
            alt={version.loaderType}
            boxSize="28px"
            borderRadius="4px"
          />
        </HStack>
      ),
      titleExtra: (
        <Tag colorScheme={primaryColor} className="tag-xs">
          {t(`ModLoaderSelector.${version.stable ? "stable" : "beta"}`)}
        </Tag>
      ),
      children: <></>,
    }),
    [primaryColor, t]
  );

  return (
    <VStack {...props} w="100%" h="100%" spacing={4}>
      <ModLoaderCards
        currentType={selectedModLoader.loaderType}
        currentVersion={selectedModLoader.version}
        displayMode="selector"
        loading={loading}
        expandedType={expandedLoaderType}
        onTypeSelect={(loaderType) => {
          if (loaderType !== selectedModLoader.loaderType) {
            onSelectModLoader({
              loaderType,
              version: "",
              description: "",
              stable: false,
            });
          } else {
            onSelectModLoader(defaultModLoaderResourceInfo);
          }
        }}
        w="100%"
      />

      <Section overflow="auto" flexGrow={1} w="100%" h="100%">
        {loading ? (
          <Center mt={8}>
            <BeatLoader size={16} color="gray" />
          </Center>
        ) : modLoaders.length === 0 ? (
          <Empty withIcon={false} size="sm" />
        ) : (
          <RadioGroup
            value={selectedModLoader?.version || ""}
            onChange={onSelectModLoaderVersion}
            h="100%"
          >
            <VirtualOptionItemGroup
              h="100%"
              items={modLoaders.map(buildOptionItems)}
            />
          </RadioGroup>
        )}
      </Section>
    </VStack>
  );
};

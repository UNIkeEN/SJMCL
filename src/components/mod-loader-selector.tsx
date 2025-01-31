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
  mockFabricVersions,
  mockForgeVersions,
  mockNeoForgeVersions,
} from "@/models/mock/resource";
import {
  GameResourceInfo,
  ModLoaderResourceInfo,
  defaultModLoaderResourceInfo,
} from "@/models/resource";
import { ISOToDatetime } from "@/utils/datetime";

const modLoaderTypesToIcon: Record<string, string> = {
  none: "",
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

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        switch (selectedModLoader.type) {
          case "Fabric": {
            let data = await new Promise<any[]>((resolve) => {
              setTimeout(() => {
                resolve(mockFabricVersions);
              }, 1000);
            });
            setModLoaders(
              data.map((v: any) => ({
                type: "Fabric",
                version: v.loader.version,
                stable: v.loader.stable,
              })) || []
            );
            break;
          }
          case "Forge": {
            let data = await new Promise<any[]>((resolve) => {
              setTimeout(() => {
                resolve(mockForgeVersions);
              }, 1000);
            });
            setModLoaders(
              data.map((v: any) => ({
                type: "Forge",
                version: v.version,
                stable: true,
                description: t("ModLoaderSelector.releaseDate", {
                  date: ISOToDatetime(v.modified),
                }),
              })) || []
            );
            break;
          }
          case "NeoForge": {
            let data = await new Promise<any[]>((resolve) => {
              setTimeout(() => {
                resolve(mockNeoForgeVersions);
              }, 1000);
            });
            setModLoaders(
              data.map((v: any) => ({
                type: "NeoForge",
                version: v.version,
                stable: !(v.version as string).endsWith("beta"),
              })) || []
            );
            break;
          }
          default:
            setModLoaders([]);
            break;
        }
      } catch (e) {
        setModLoaders([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedModLoader.type, t]);

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
            src={`/images/icons/${modLoaderTypesToIcon[version.type]}`}
            alt={version.type}
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
        currentType={selectedModLoader.type}
        currentVersion={selectedModLoader.version}
        displayMode="selector"
        loading={loading}
        onTypeSelect={(type) => {
          if (type !== selectedModLoader.type) {
            onSelectModLoader({
              type,
              version: "",
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
          <Center>
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

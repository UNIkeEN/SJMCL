import {
  Box,
  BoxProps,
  Center,
  Checkbox,
  HStack,
  Icon,
  IconButton,
  Image,
  Tag,
  Text,
  Tooltip,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEarth, LuRefreshCcw } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import {
  OptionItem,
  OptionItemGroup,
  OptionItemProps,
} from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { GameResourceInfo } from "@/models/resource/game-resource-info";
import { ISOtoDate } from "@/utils/datetime";

interface GameResourceVersionListProps extends BoxProps {}

const GameResourceVersionList: React.FC<GameResourceVersionListProps> = ({
  ...props
}) => {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<GameResourceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(["release"])
  );
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const gameTypes: Record<string, string> = useMemo(
    () => ({
      release: "GrassBlock.webp",
      snapshot: "CommandBlock.webp",
      oldBeta: "CraftingTable.webp",
    }),
    []
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "https://launchermeta.mojang.com/mc/game/version_manifest.json"
      );
      const data = await response.json();

      const versionData = data.versions.map(
        (version: {
          id: string;
          type: string;
          releaseTime: string;
          url: string;
        }) => ({
          version: {
            id: version.id,
            type: version.type,
            releaseTime: version.releaseTime,
            url: version.url,
          },
        })
      );

      setVersions(versionData);
    } catch (error) {
      console.error("Error fetching versions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filterVersions = useCallback(
    (versions: GameResourceInfo[]) =>
      versions.filter(
        (version) =>
          version.version &&
          version.version.type &&
          selectedTypes.has(version.version.type)
      ),
    [selectedTypes]
  );

  const sortVersions = (versions: GameResourceInfo[]) =>
    versions.sort(
      (a, b) =>
        new Date(b.version.releaseTime).getTime() -
        new Date(a.version.releaseTime).getTime()
    );

  const handleTypeToggle = (type: string) => {
    setSelectedTypes((prev) => {
      const newSelectedTypes = new Set(prev);
      if (newSelectedTypes.has(type)) {
        newSelectedTypes.delete(type);
      } else {
        newSelectedTypes.add(type);
      }
      return newSelectedTypes;
    });
  };

  const processedVersions = useMemo(() => {
    const filteredVersions = filterVersions(versions);
    return sortVersions(filteredVersions);
  }, [versions, filterVersions]);

  const buildOptionItem = (version: GameResourceInfo): OptionItemProps => ({
    title: version.version.id,
    description: ISOtoDate(version.version.releaseTime),
    children: null,
    prefixElement: (
      <Image
        src={`/images/icons/${gameTypes[version.version.type]}`}
        alt={version.version.type}
        boxSize="28px"
        borderRadius="4px"
      />
    ),
    titleExtra: (
      <Box display="inline-flex" alignItems="center">
        <Tag colorScheme={primaryColor}>
          {t(`GameResourceVersionList.${version.version.type}`)}
        </Tag>
      </Box>
    ),
  });

  return (
    <Box p={4} {...props} w="100%">
      <Section
        titleExtra={
          <HStack spacing={4}>
            {Object.keys(gameTypes).map((type) => (
              <Checkbox
                key={type}
                isChecked={selectedTypes.has(type)}
                onChange={() => handleTypeToggle(type)}
                colorScheme={primaryColor}
                borderColor="black"
              >
                <HStack spacing={2} alignItems="center">
                  <Text fontWeight="bold" fontSize="sm" className="no-select">
                    {t(`GameResourceVersionList.${type}`)}
                  </Text>
                  <CountTag
                    count={
                      processedVersions.filter((v) => v.version.type === type)
                        .length
                    }
                  />
                </HStack>
              </Checkbox>
            ))}
          </HStack>
        }
        headExtra={
          <IconButton
            aria-label="refresh"
            icon={<Icon as={LuRefreshCcw} boxSize={3.5} />}
            onClick={fetchData}
            size="xs"
            h={21}
            variant="ghost"
            colorScheme="gray"
            aria-live="polite"
          />
        }
      >
        {loading ? (
          <Center h="100%">
            <BeatLoader size={16} color={primaryColor} />
          </Center>
        ) : processedVersions.length === 0 ? (
          <Empty size="sm" />
        ) : (
          <OptionItemGroup
            items={processedVersions.map((version) => (
              <OptionItem
                key={version.version.id}
                childrenOnHover
                {...buildOptionItem(version)}
              >
                <Tooltip
                  label={t("GameResourceVersionList.viewOnWiki")}
                  aria-label={t("GameResourceVersionList.viewOnWiki")}
                >
                  <Box display="inline-block" _hover={{ cursor: "pointer" }}>
                    <Icon
                      as={LuEarth}
                      boxSize={5}
                      color="black"
                      onClick={() =>
                        open(
                          `https://zh.minecraft.wiki/w/${version.version.id}`
                        )
                      }
                    />
                  </Box>
                </Tooltip>
              </OptionItem>
            ))}
            w="100%"
          />
        )}
      </Section>
    </Box>
  );
};

export default GameResourceVersionList;

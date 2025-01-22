import {
  Box,
  BoxProps,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEarth, LuRefreshCcw } from "react-icons/lu";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import {
  OptionItem,
  OptionItemGroup,
  OptionItemProps,
} from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";

interface VersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: {
    id: string;
    type: string;
    releaseTime: string;
    url: string;
  }[];
}

interface GameResourceInfoProps extends BoxProps {}

const GameResourceInfo: React.FC<GameResourceInfoProps> = ({ ...props }) => {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<OptionItemProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(["release"])
  );
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const typeData = useMemo(
    () => ({
      release: {
        label: t("gameResourceInfo.release"),
        icon: "/images/icons/grass.png",
      },
      snapshot: {
        label: t("gameResourceInfo.snapshot"),
        icon: "/images/icons/command.png",
      },
      old_beta: {
        label: t("gameResourceInfo.oldBeta"),
        icon: "/images/icons/craft_table.png",
      },
    }),
    [t]
  );

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "https://launchermeta.mojang.com/mc/game/version_manifest.json"
      );
      const data: VersionManifest = await response.json();

      const filteredVersions = data.versions.filter((version) =>
        selectedTypes.has(version.type)
      );

      const sortedVersions = filteredVersions.sort(
        (a, b) =>
          new Date(b.releaseTime).getTime() - new Date(a.releaseTime).getTime()
      );

      const versionItems = sortedVersions.map((version) => ({
        title: version.id,
        description: formatDate(version.releaseTime),
        children: null,
        prefixElement: (
          <Image
            src={typeData[version.type as keyof typeof typeData]?.icon}
            alt={version.type}
            boxSize="20px"
            borderRadius="4px"
          />
        ),
        titleExtra: (
          <Box display="inline-flex" alignItems="center">
            <Tag colorScheme={primaryColor} ml={2}>
              {typeData[version.type as keyof typeof typeData].label}
            </Tag>
          </Box>
        ),
      }));

      setVersions(versionItems);

      const typeCount: Record<string, number> = {};
      sortedVersions.forEach((version) => {
        const type = version.type;
        if (!typeCount[type]) {
          typeCount[type] = 0;
        }
        typeCount[type]++;
      });

      setTypeCount(typeCount);
    } catch (error) {
      console.error("Error fetching versions:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedTypes, primaryColor, typeData]);

  const [typeCount, setTypeCount] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  return (
    <Box p={4} {...props} w="100%">
      <Section
        titleExtra={
          <HStack spacing={4}>
            {Object.keys(typeData).map((type) => (
              <Checkbox
                key={type}
                isChecked={selectedTypes.has(type)}
                onChange={() => handleTypeToggle(type)}
                colorScheme={primaryColor}
                borderColor="black"
              >
                <HStack spacing={2}>
                  <Text fontWeight="bold">
                    {typeData[type as keyof typeof typeData].label}
                  </Text>
                  <CountTag count={typeCount[type]} />
                </HStack>
              </Checkbox>
            ))}
          </HStack>
        }
        headExtra={
          <IconButton
            aria-label="refresh"
            icon={<Icon as={LuRefreshCcw} />}
            onClick={fetchData}
            variant="ghost"
            colorScheme="gray"
            aria-live="polite"
          />
        }
      >
        {loading ? (
          <Empty description={t("gameResourceInfo.loading")} />
        ) : versions.length === 0 ? (
          <Empty description={t("gameResourceInfo.noVersions")} />
        ) : (
          <OptionItemGroup
            items={versions.map((version) => (
              <OptionItem
                key={version.title}
                childrenOnHover
                title={version.title}
                titleExtra={version.titleExtra}
                description={version.description}
                prefixElement={version.prefixElement}
              >
                <Tooltip
                  label={t("gameResourceInfo.viewOnWiki")}
                  aria-label={t("gameResourceInfo.viewOnWiki")}
                >
                  <Box display="inline-block" _hover={{ cursor: "pointer" }}>
                    <Icon
                      as={LuEarth}
                      boxSize={5}
                      color="black"
                      onClick={() =>
                        window.open(
                          `https://zh.minecraft.wiki/w/${version.title}`,
                          "_blank"
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

export default GameResourceInfo;

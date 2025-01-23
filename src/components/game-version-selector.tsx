import {
  Box,
  BoxProps,
  Center,
  Checkbox,
  HStack,
  Icon,
  IconButton,
  Image,
  Radio,
  RadioGroup,
  Tag,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEarth, LuRefreshCcw } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import {
  OptionItemGroup,
  OptionItemProps,
} from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { GameResourceInfo } from "@/models/resource";
import { ISOToDatetime } from "@/utils/datetime";

interface GameVersionSelectorProps extends BoxProps {
  selectedVersion: string;
  onVersionSelect: (versionId: string) => void;
}

const GameVersionSelector: React.FC<GameVersionSelectorProps> = ({
  selectedVersion,
  onVersionSelect,
  ...props
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [versions, setVersions] = useState<GameResourceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(["release"])
  );

  const gameTypes: Record<string, string> = {
    release: "GrassBlock.webp",
    snapshot: "CommandBlock.webp",
    old_beta: "CraftingTable.webp",
  };

  // @TODO: move this logic to backend and get data by invoke
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
          id: version.id,
          type: version.type,
          releaseTime: version.releaseTime,
          url: version.url,
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

  const buildOptionItems = (version: GameResourceInfo): OptionItemProps => ({
    title: version.id,
    description: ISOToDatetime(version.releaseTime),
    prefixElement: (
      <HStack spacing={2.5}>
        <Radio value={version.id} colorScheme={primaryColor} />
        <Image
          src={`/images/icons/${gameTypes[version.type]}`}
          alt={version.type}
          boxSize="28px"
          borderRadius="4px"
        />
      </HStack>
    ),
    titleExtra: (
      <Tag colorScheme={primaryColor} className="tag-xs">
        {t(`GameVersionSelector.${version.type}`)}
      </Tag>
    ),
    children: (
      <Tooltip label={t("GameVersionSelector.viewOnWiki")}>
        <IconButton
          size="sm"
          aria-label="viewOnWiki"
          icon={<LuEarth />}
          variant="ghost"
          onClick={() => open(`https://zh.minecraft.wiki/w/${version.id}`)}
        />
      </Tooltip>
    ),
  });

  return (
    <Box {...props}>
      <Section
        titleExtra={
          <HStack spacing={4}>
            {Object.keys(gameTypes).map((type) => (
              <Checkbox
                key={type}
                isChecked={selectedTypes.has(type)}
                onChange={() => handleTypeToggle(type)}
                colorScheme={primaryColor}
                borderColor="gray.400"
              >
                <HStack spacing={2} alignItems="center">
                  <Text fontWeight="bold" fontSize="sm" className="no-select">
                    {t(`GameVersionSelector.${type}`)}
                  </Text>
                  <CountTag
                    count={versions.filter((v) => v.type === type).length}
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
            size="sm"
            h={21}
            variant="ghost"
            colorScheme="gray"
          />
        }
      >
        {loading ? (
          <Center>
            <BeatLoader size={16} color="gray" />
          </Center>
        ) : selectedTypes.size === 0 ? (
          <Empty withIcon={false} size="sm" />
        ) : (
          <RadioGroup value={selectedVersion || ""} onChange={onVersionSelect}>
            <OptionItemGroup
              items={versions
                .filter((v) => selectedTypes.has(v.type))
                .map(buildOptionItems)}
            />
          </RadioGroup>
        )}
      </Section>
    </Box>
  );
};

export default GameVersionSelector;

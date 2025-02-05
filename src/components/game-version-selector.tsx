import {
  Box,
  BoxProps,
  Center,
  Checkbox,
  Flex,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEarth, LuRefreshCcw } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import {
  OptionItemProps,
  VirtualOptionItemGroup,
} from "@/components/common/option-item-virtual";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { GameResourceInfo } from "@/models/resource";
import { ResourceService } from "@/services/resource";
import { ISOToDatetime } from "@/utils/datetime";

const gameTypesToIcon: Record<string, string> = {
  release: "GrassBlock.png",
  snapshot: "CommandBlock.png",
  old_beta: "StoneOldBeta.png",
  april_fools: "WhiteGlazedTerracotta.png",
};

interface GameVersionSelectorProps extends BoxProps {
  selectedVersion: GameResourceInfo | undefined;
  onVersionSelect: (version: GameResourceInfo) => void;
}

const GameVersionSelector: React.FC<GameVersionSelectorProps> = ({
  selectedVersion,
  onVersionSelect,
  ...props
}) => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const toast = useToast();
  const primaryColor = config.appearance.theme.primaryColor;

  const [versions, setVersions] = useState<GameResourceInfo[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(config.states.gameVersionSelector.gameTypes)
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const response = await ResourceService.retriveGameVersionList();
    if (response.status === "success") {
      console.log(response.data);
      const versionData = response.data;
      const newCounts = new Map<string, number>();
      versionData.forEach((version: GameResourceInfo) => {
        let oldCount = newCounts.get(version.gameType) || 0;
        newCounts.set(version.gameType, oldCount + 1);
      });
      setCounts(newCounts);

      setVersions(
        versionData.filter((version: GameResourceInfo) =>
          selectedTypes.has(version.gameType)
        )
      );
    } else {
      setVersions([]);
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
    }
    setIsLoading(false);
  }, [selectedTypes, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTypeToggle = useCallback(
    (gameType: string) => {
      setSelectedTypes((prevSelectedTypes) => {
        const newSelectedTypes = new Set(prevSelectedTypes);
        if (newSelectedTypes.has(gameType)) {
          newSelectedTypes.delete(gameType);
        } else {
          newSelectedTypes.add(gameType);
        }
        update(
          "states.gameVersionSelector.gameTypes",
          Array.from(newSelectedTypes)
        );
        return newSelectedTypes;
      });
    },
    [update]
  );

  const buildOptionItems = (version: GameResourceInfo): OptionItemProps => ({
    title: version.id,
    description: ISOToDatetime(version.releaseTime),
    prefixElement: (
      <HStack spacing={2.5}>
        <Radio value={version.id} colorScheme={primaryColor} />
        <Image
          src={`/images/icons/${gameTypesToIcon[version.gameType]}`}
          alt={version.gameType}
          boxSize="28px"
          borderRadius="4px"
        />
      </HStack>
    ),
    titleExtra: (
      <Tag colorScheme={primaryColor} className="tag-xs">
        {t(`GameVersionSelector.${version.gameType}`)}
      </Tag>
    ),
    children: (
      <Tooltip label={t("General.viewOnWiki")}>
        <IconButton
          size="sm"
          aria-label="viewOnWiki"
          icon={<LuEarth />}
          variant="ghost"
          onClick={() => {
            open(
              `${t("Utils.wiki.baseUrl")}${t(`GameVersionSelector.wikiKey.${version.gameType}`)}${
                version.gameType === "snapshot"
                  ? version.id.replace("b", "")
                  : version.id
              }`
            );
          }}
        />
      </Tooltip>
    ),
  });

  const gameTypeTogglers = useMemo(() => {
    return (
      <HStack spacing={4}>
        {Object.keys(gameTypesToIcon).map((gameType) => (
          <Checkbox
            key={gameType}
            isChecked={selectedTypes.has(gameType)}
            onChange={() => handleTypeToggle(gameType)}
            colorScheme={primaryColor}
            borderColor="gray.400"
          >
            <HStack spacing={2} alignItems="center">
              <Text fontWeight="bold" fontSize="sm" className="no-select">
                {t(`GameVersionSelector.${gameType}`)}
              </Text>
              <CountTag count={counts ? counts.get(gameType) || 0 : 0} />
            </HStack>
          </Checkbox>
        ))}
      </HStack>
    );
  }, [counts, handleTypeToggle, primaryColor, selectedTypes, t]);

  const onVersionIdSelect = useCallback(
    (versionId: string) => {
      let _versions = versions.filter((v) => v.id === versionId);
      if (_versions.length > 0) onVersionSelect(_versions[0]);
    },
    [versions, onVersionSelect]
  );

  return (
    <Flex
      {...props}
      flexDirection="column"
      overflow="hidden"
      width="100%"
      height="100%"
    >
      <Flex justifyContent="space-between" flexShrink={0} padding={1} mb={2.5}>
        {gameTypeTogglers}
        <IconButton
          aria-label="refresh"
          icon={<Icon as={LuRefreshCcw} boxSize={3.5} />}
          onClick={fetchData}
          size="sm"
          h={21}
          variant="ghost"
          colorScheme="gray"
        />
      </Flex>
      <Section overflow="auto" flexGrow={1} h="100%">
        {isLoading ? (
          <Center>
            <BeatLoader size={16} color="gray" />
          </Center>
        ) : selectedTypes.size === 0 || versions.length === 0 ? (
          <Empty withIcon={false} size="sm" />
        ) : (
          <RadioGroup
            value={selectedVersion?.id || ""}
            onChange={onVersionIdSelect}
            h="100%"
          >
            <VirtualOptionItemGroup
              h="100%"
              items={versions.map(buildOptionItems)}
            />
          </RadioGroup>
        )}
      </Section>
    </Flex>
  );
};

export default GameVersionSelector;

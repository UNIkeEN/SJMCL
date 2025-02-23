import {
  BoxProps,
  Center,
  Checkbox,
  Flex,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  Radio,
  RadioGroup,
  Tag,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEarth, LuRefreshCcw, LuSearch } from "react-icons/lu";
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
  april_fools: "YellowGlazedTerracotta.png",
};

interface GameVersionSelectorProps extends BoxProps {
  selectedVersion: GameResourceInfo | undefined;
  onVersionSelect: (version: GameResourceInfo) => void;
}

export const GameVersionSelector: React.FC<GameVersionSelectorProps> = ({
  selectedVersion,
  onVersionSelect,
  ...props
}) => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const toast = useToast();
  const primaryColor = config.appearance.theme.primaryColor;

  const [versions, setVersions] = useState<GameResourceInfo[]>([]);
  const [filteredVersions, setFilteredVersions] = useState<GameResourceInfo[]>(
    []
  );
  const [counts, setCounts] = useState<Map<string, number>>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(config.states.gameVersionSelector.gameTypes)
  );

  const [searchText, setSearchText] = useState("");

  const handleFetchGameVersionList = useCallback(async () => {
    setIsLoading(true);
    const response = await ResourceService.fetchGameVersionList();
    if (response.status === "success") {
      const versionData = response.data;
      setVersions(versionData);
      const newCounts = new Map<string, number>();
      versionData.forEach((version: GameResourceInfo) => {
        let oldCount = newCounts.get(version.gameType) || 0;
        newCounts.set(version.gameType, oldCount + 1);
      });
      setCounts(newCounts);
    } else {
      setVersions([]);
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    setFilteredVersions(
      versions
        .filter((version) => selectedTypes.has(version.gameType))
        .filter((version) =>
          version.id.toLowerCase().includes(searchText.toLowerCase())
        )
    );
  }, [versions, selectedTypes, searchText]);

  useEffect(() => {
    handleFetchGameVersionList();
  }, [handleFetchGameVersionList]);

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
            openUrl(
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
      <>
        {Object.keys(gameTypesToIcon).map((gameType) => (
          <Checkbox
            key={gameType}
            isChecked={selectedTypes.has(gameType)}
            onChange={() => handleTypeToggle(gameType)}
            colorScheme={primaryColor}
            borderColor="gray.400"
          >
            <HStack spacing={1} alignItems="center" w="max-content">
              <Text fontWeight="bold" fontSize="sm" className="no-select">
                {t(`GameVersionSelector.${gameType}`)}
              </Text>
              <CountTag count={counts ? counts.get(gameType) || 0 : 0} />
            </HStack>
          </Checkbox>
        ))}
      </>
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
      <HStack py={1} gap={2}>
        {gameTypeTogglers}
        <InputGroup flexGrow={1} size="xs">
          <InputLeftElement h="100%" pointerEvents="none">
            <LuSearch />
          </InputLeftElement>
          <Input
            focusBorderColor={`${primaryColor}.500`}
            borderRadius="md"
            placeholder={t("GameVersionSelector.searchPlaceholder")}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </InputGroup>
        <IconButton
          aria-label="refresh"
          icon={<Icon as={LuRefreshCcw} boxSize={3.5} />}
          onClick={handleFetchGameVersionList}
          size="xs"
          variant="ghost"
          colorScheme="gray"
        />
      </HStack>
      <Section overflow="auto" flexGrow={1} h="100%">
        {isLoading ? (
          <Center>
            <BeatLoader size={16} color="gray" />
          </Center>
        ) : selectedTypes.size === 0 || filteredVersions.length === 0 ? (
          <Empty withIcon={false} size="sm" />
        ) : (
          <RadioGroup
            value={selectedVersion?.id || ""}
            onChange={onVersionIdSelect}
            h="100%"
          >
            <VirtualOptionItemGroup
              h="100%"
              items={filteredVersions.map(buildOptionItems)}
            />
          </RadioGroup>
        )}
      </Section>
    </Flex>
  );
};

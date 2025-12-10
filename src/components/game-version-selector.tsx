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
import MCVersionNumberHelper from "@/components/mc-version-number-helper";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { GetStateFlag } from "@/hooks/get-state";
import { GameClientResourceInfo } from "@/models/resource";
import { ISOToDatetime } from "@/utils/datetime";
import { getGameVersionWikiLink } from "@/utils/wiki";

const gameTypesToIcon: Record<string, string> = {
  release: "JEIcon_Release.png",
  snapshot: "JEIcon_Snapshot.png",
  old_beta: "StoneOldBeta.png",
  april_fools: "YellowGlazedTerracotta.png",
};

interface GameVersionSelectorProps extends BoxProps {
  selectedVersion: GameClientResourceInfo | undefined;
  onVersionSelect: (version: GameClientResourceInfo) => void;
}

export const GameVersionSelector: React.FC<GameVersionSelectorProps> = ({
  selectedVersion,
  onVersionSelect,
  ...props
}) => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const { getGameVersionList, isGameVersionListLoading: isLoading } =
    useGlobalData();
  const [versions, setVersions] = useState<GameClientResourceInfo[]>([]);
  const [filteredVersions, setFilteredVersions] = useState<
    GameClientResourceInfo[]
  >([]);
  const [counts, setCounts] = useState<Map<string, number>>();
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(config.states.gameVersionSelector.gameTypes)
  );
  const [searchText, setSearchText] = useState("");
  const [mounted, setMounted] = useState(false);

  const getGameVersionListWrapper = useCallback(() => {
    getGameVersionList(true)
      .then((data) => {
        if (data === GetStateFlag.Cancelled) return;
        setVersions(data || []);
      })
      .catch((e) => setVersions([] as GameClientResourceInfo[]));
  }, [getGameVersionList]);

  useEffect(() => {
    if (!mounted) {
      getGameVersionListWrapper();
      setMounted(true);
    }
  }, [mounted, getGameVersionListWrapper]);

  useEffect(() => {
    const newCounts = new Map<string, number>();
    versions.forEach((version: GameClientResourceInfo) => {
      let oldCount = newCounts.get(version.gameType) || 0;
      newCounts.set(version.gameType, oldCount + 1);
    });
    setCounts(newCounts);
  }, [versions]);

  useEffect(() => {
    setFilteredVersions(
      versions
        .filter((version) => selectedTypes.has(version.gameType))
        .filter((version) =>
          version.id.toLowerCase().includes(searchText.toLowerCase())
        )
    );
  }, [versions, selectedTypes, searchText]);

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

  const buildOptionItems = (
    version: GameClientResourceInfo
  ): OptionItemProps => ({
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
          onClick={(e) => {
            e.stopPropagation();
            openUrl(getGameVersionWikiLink(version.id));
          }}
        />
      </Tooltip>
    ),
    isChildrenIndependent: true,
    isFullClickZone: true,
    onClick: () => onVersionSelect(version),
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
              <Text fontWeight="bold" fontSize="sm">
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
        <MCVersionNumberHelper placement="bottom-end" />
        <IconButton
          aria-label="refresh"
          icon={<Icon as={LuRefreshCcw} boxSize={3.5} />}
          onClick={getGameVersionListWrapper}
          size="xs"
          variant="ghost"
          colorScheme="gray"
        />
      </HStack>
      <Section overflow="auto" flexGrow={1} h="100%">
        {isLoading ? (
          <Center mt={8}>
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

import {
  Box,
  BoxProps,
  HStack,
  Icon,
  Image,
  Radio,
  RadioGroup,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { FaStar } from "react-icons/fa6";
import Empty from "@/components/common/empty";
import { OptionItemGroup } from "@/components/common/option-item";
import { WrapCardGroup } from "@/components/common/wrap-card";
import GameMenu from "@/components/game-menu";
import { useLauncherConfig } from "@/contexts/config";
import { useData, useDataDispatch } from "@/contexts/data";
import { GameInstanceSummary } from "@/models/instance/misc";

interface GamesViewProps extends BoxProps {
  games: GameInstanceSummary[];
  viewType: string;
  onSelectCallback?: () => void;
  withMenu?: boolean;
}

const GamesView: React.FC<GamesViewProps> = ({
  games,
  viewType,
  onSelectCallback = () => {},
  withMenu = true,
  ...boxProps
}) => {
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { getSelectedGameInstance } = useData();
  const [selectedGameInstance, _setSelectedGameInstance] =
    useState<GameInstanceSummary>();

  const { setSelectedGameInstance } = useDataDispatch(); // TODO：remove global state setter here after replace mock logic

  useEffect(() => {
    _setSelectedGameInstance(getSelectedGameInstance());
  }, [getSelectedGameInstance]);

  const generateDesc = (game: GameInstanceSummary) => {
    if (game.modLoader.loaderType === "Unknown") {
      return game.version || "";
    }
    return [
      game.version,
      `${game.modLoader.loaderType} ${game.modLoader.version}`,
    ]
      .filter(Boolean)
      .join(", ");
  };

  const handleUpdateSelectedGameInstance = (game: GameInstanceSummary) => {
    // TODO: add service logic
    setSelectedGameInstance(game);
    onSelectCallback();
  };

  const listItems = games.map((game) => ({
    title: game.name,
    description: [generateDesc(game), game.description]
      .filter(Boolean)
      .join(", "),
    ...{
      titleExtra: game.starred && (
        <Icon as={FaStar} mt={-1} color="yellow.500" />
      ),
    },
    prefixElement: (
      <HStack spacing={2.5}>
        <Radio
          value={game.id.toString()}
          onClick={() => handleUpdateSelectedGameInstance(game)}
          colorScheme={primaryColor}
        />
        <Image
          boxSize="32px"
          objectFit="cover"
          src={game.iconSrc}
          alt={game.name}
        />
      </HStack>
    ),
    ...(withMenu
      ? {}
      : {
          isFullClickZone: true,
          onClick: () => handleUpdateSelectedGameInstance(game),
        }),
    children: withMenu ? <GameMenu game={game} variant="buttonGroup" /> : <></>,
  }));

  const gridItems = games.map((game) => ({
    cardContent: {
      title: game.name,
      description: generateDesc(game) || String.fromCharCode(160),
      image: game.iconSrc,
      extraContent: (
        <HStack spacing={1} position="absolute" top={0.5} right={1}>
          {game.starred && <Icon as={FaStar} color="yellow.500" />}
          {withMenu && <GameMenu game={game} />}
        </HStack>
      ),
    },
    isSelected: selectedGameInstance?.id === game.id,
    radioValue: game.id.toString(),
    onSelect: () => handleUpdateSelectedGameInstance(game),
  }));

  return (
    <Box {...boxProps}>
      {games.length > 0 ? (
        <RadioGroup value={selectedGameInstance?.id.toString()}>
          {viewType === "list" ? (
            <OptionItemGroup items={listItems} />
          ) : (
            <WrapCardGroup items={gridItems} variant="radio" />
          )}
        </RadioGroup>
      ) : (
        <Empty withIcon={false} size="sm" />
      )}
    </Box>
  );
};

export default GamesView;

import { BoxProps, HStack, Image, Radio, RadioGroup } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { OptionItemGroup } from "@/components/common/option-item";
import { GameMenuBtnGroup } from "@/components/game-menu";
import { useLauncherConfig } from "@/contexts/config";
import { GameInstanceSummary } from "@/models/game-instance";

interface GamesListProps extends BoxProps {
  games: GameInstanceSummary[];
  selectedGame: GameInstanceSummary | undefined;
  setSelectedGame: (game: GameInstanceSummary) => void;
}

const GamesListView: React.FC<GamesListProps> = ({
  games,
  selectedGame,
  setSelectedGame,
  ...boxProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const items = games.map((game) => ({
    title: game.name,
    description: game.description,
    prefixElement: (
      <HStack spacing={2.5}>
        <Radio
          value={game.uuid}
          onClick={() => setSelectedGame(game)}
          colorScheme={primaryColor}
        />
        <Image
          boxSize="32px"
          objectFit="cover"
          src={game.iconUrl}
          alt={game.name}
        />
      </HStack>
    ),
    children: <GameMenuBtnGroup game={game} />,
  }));

  return (
    <RadioGroup value={selectedGame?.uuid}>
      <OptionItemGroup items={items} {...boxProps} />
    </RadioGroup>
  );
};

export default GamesListView;

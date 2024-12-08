import {
  Box,
  BoxProps,
  Card,
  Image,
  Radio,
  RadioGroup,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import GameMenu from "@/components/game-menu";
import { useLauncherConfig } from "@/contexts/config";
import { GameInstanceSummary } from "@/models/game-instance";

interface GameCardProps {
  game: GameInstanceSummary;
  isSelected: boolean;
  onSelect: () => void;
}

interface GamesGridProps extends BoxProps {
  games: GameInstanceSummary[];
  selectedGame: GameInstanceSummary | undefined;
  setSelectedGame: (game: GameInstanceSummary) => void;
}

const GameCard: React.FC<GameCardProps> = ({ game, isSelected, onSelect }) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  return (
    <Card
      className="content-card"
      w="10.55rem"
      borderColor={`${primaryColor}.500`}
      variant={isSelected ? "outline" : "elevated"}
    >
      <Box position="absolute" top={2} left={2}>
        <Radio
          value={game.uuid}
          onClick={onSelect}
          colorScheme={primaryColor}
        />
      </Box>
      <Box position="absolute" top={0.5} right={1}>
        <GameMenu game={game} />
      </Box>
      <VStack spacing={0}>
        <Image
          boxSize="36px"
          objectFit="cover"
          src={game.iconUrl}
          alt={game.name}
        />
        <Text
          fontSize="xs-sm"
          className="no-select"
          fontWeight={isSelected ? "bold" : "normal"}
          mt={2}
        >
          {game.name}
        </Text>
        <Text fontSize="xs" className="secondary-text no-select ellipsis-text">
          {game.description}
        </Text>
      </VStack>
    </Card>
  );
};

const GamesGridView: React.FC<GamesGridProps> = ({
  games,
  selectedGame,
  setSelectedGame,
  ...boxProps
}) => {
  return (
    <RadioGroup value={selectedGame?.uuid}>
      <Wrap spacing={3.5} {...boxProps}>
        {games.map((game, index) => (
          <WrapItem key={game.id}>
            <GameCard
              game={game}
              isSelected={selectedGame?.uuid === game.uuid}
              onSelect={() => setSelectedGame(game)}
            />
            {/* TBD: only mock */}
          </WrapItem>
        ))}
      </Wrap>
    </RadioGroup>
  );
};

export default GamesGridView;

import { Box, BoxProps, HStack, Radio, RadioGroup } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import Empty from "@/components/common/empty";
import { OptionItemGroup } from "@/components/common/option-item";
import { WrapCardGroup } from "@/components/common/wrap-card";
import PlayerAvatar from "@/components/player-avatar";
import PlayerMenu from "@/components/player-menu";
import { useLauncherConfig } from "@/contexts/config";
import { Player } from "@/models/account";
import { generatePlayerDesc } from "@/utils/account";

interface PlayersViewProps extends BoxProps {
  players: Player[];
  selectedPlayer: Player | undefined;
  viewType: string;
  onSelectCallback?: () => void;
  withMenu?: boolean;
}

const PlayersView: React.FC<PlayersViewProps> = ({
  players,
  selectedPlayer,
  viewType,
  onSelectCallback = () => {},
  withMenu = true,
  ...boxProps
}) => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const handleUpdateSelectedPlayer = (playerId: string) => {
    update("states.shared.selectedPlayerId", playerId);
    onSelectCallback();
  };

  const listItems = players.map((player) => ({
    title: player.name,
    description: generatePlayerDesc(player, true),
    prefixElement: (
      <HStack spacing={2.5}>
        <Radio
          value={player.id}
          onClick={() => handleUpdateSelectedPlayer(player.id)}
          colorScheme={primaryColor}
        />
        <PlayerAvatar avatar={player.avatar} boxSize="32px" objectFit="cover" />
      </HStack>
    ),
    ...(withMenu
      ? {}
      : {
          isFullClickZone: true,
          onClick: () => handleUpdateSelectedPlayer(player.id),
        }),
    children: withMenu ? (
      <PlayerMenu player={player} variant="buttonGroup" />
    ) : (
      <></>
    ),
  }));

  const gridItems = players.map((player) => ({
    cardContent: {
      title: player.name,
      description: generatePlayerDesc(player, false),
      image: (
        <PlayerAvatar avatar={player.avatar} boxSize="36px" objectFit="cover" />
      ),
      ...(withMenu
        ? {
            extraContent: (
              <Box position="absolute" top={0.5} right={1}>
                <PlayerMenu player={player} />
              </Box>
            ),
          }
        : {}),
    },
    isSelected: selectedPlayer?.id === player.id,
    onSelect: () => handleUpdateSelectedPlayer(player.id),
    radioValue: player.id,
  }));

  return (
    <Box {...boxProps}>
      {players.length > 0 ? (
        <RadioGroup value={selectedPlayer?.id}>
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

export default PlayersView;

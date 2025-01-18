import {
  Box,
  BoxProps,
  HStack,
  Image,
  Radio,
  RadioGroup,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import Empty from "@/components/common/empty";
import { OptionItemGroup } from "@/components/common/option-item";
import { WrapCardGroup } from "@/components/common/wrap-card";
import PlayerMenu from "@/components/player-menu";
import { useLauncherConfig } from "@/contexts/config";
import { useData, useDataDispatch } from "@/contexts/data";
import { Player } from "@/models/account";

interface PlayersViewProps extends BoxProps {
  players: Player[];
  viewType: string;
}

const PlayersView: React.FC<PlayersViewProps> = ({
  players,
  viewType,
  ...boxProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { selectedPlayer } = useData();
  const { setSelectedPlayer } = useDataDispatch();

  const listItems = players.map((player) => ({
    title: player.name,
    description:
      player.playerType === "offline"
        ? t("Enums.playerTypes.offline")
        : `${t("Enums.playerTypes.3rdparty")} - ${player.authServer?.name} (${player.authAccount})`,
    prefixElement: (
      <HStack spacing={2.5}>
        <Radio
          value={player.uuid}
          onClick={() => setSelectedPlayer(player)}
          colorScheme={primaryColor}
        />
        <Image
          boxSize="32px"
          objectFit="cover"
          src={player.avatarSrc}
          alt={player.name}
        />
      </HStack>
    ),
    children: <PlayerMenu player={player} variant="buttonGroup" />,
  }));

  const gridItems = players.map((player) => ({
    cardContent: {
      title: player.name,
      description:
        player.playerType === "offline"
          ? t("Enums.playerTypes.offline")
          : player.authServer?.name || "",
      image: player.avatarSrc,
      extraContent: (
        <Box position="absolute" top={0.5} right={1}>
          <PlayerMenu player={player} />
        </Box>
      ),
    },
    isSelected: selectedPlayer?.uuid === player.uuid,
    onSelect: () => setSelectedPlayer(player),
    radioValue: player.uuid,
  }));

  return (
    <Box {...boxProps}>
      {players.length > 0 ? (
        <RadioGroup value={selectedPlayer?.uuid}>
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

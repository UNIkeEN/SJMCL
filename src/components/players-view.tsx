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
import { useData } from "@/contexts/data";
import { useToast } from "@/contexts/toast";
import { Player } from "@/models/account";
import { AccountService } from "@/services/account";
import { genPlayerId } from "@/utils/account";
import { base64ImgSrc } from "@/utils/string";

interface PlayersViewProps extends BoxProps {
  players: Player[];
  viewType: string;
  onSelectCallback?: () => void;
  withMenu?: boolean;
}

const PlayersView: React.FC<PlayersViewProps> = ({
  players,
  viewType,
  onSelectCallback = () => {},
  withMenu = true,
  ...boxProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { getSelectedPlayer } = useData();
  const selectedPlayer = getSelectedPlayer();
  const toast = useToast();

  const handleUpdateSelectedPlayer = (playerId: string) => {
    AccountService.updateSelectedPlayer(playerId).then((response) => {
      if (response.status === "success") {
        getSelectedPlayer(true);
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
    onSelectCallback();
  };

  const listItems = players.map((player) => ({
    title: player.name,
    description:
      player.playerType === "offline" || player.playerType === "microsoft"
        ? t(`Enums.playerTypes.${player.playerType}`)
        : `${t("Enums.playerTypes.3rdparty")} - ${player.authServer?.name} (${player.authAccount})`,
    prefixElement: (
      <HStack spacing={2.5}>
        <Radio
          value={player.uuid}
          onClick={() => handleUpdateSelectedPlayer(genPlayerId(player))}
          colorScheme={primaryColor}
        />
        <Image
          boxSize="32px"
          objectFit="cover"
          src={base64ImgSrc(player.avatar)}
          alt={player.name}
        />
      </HStack>
    ),
    children: withMenu ? (
      <PlayerMenu player={player} variant="buttonGroup" />
    ) : (
      <></>
    ),
  }));

  const gridItems = players.map((player) => ({
    cardContent: {
      title: player.name,
      description:
        player.playerType === "offline" || player.playerType === "microsoft"
          ? t(`Enums.playerTypes.${player.playerType}`)
          : player.authServer?.name || "",
      image: base64ImgSrc(player.avatar),
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
    isSelected: selectedPlayer?.uuid === player.uuid,
    onSelect: () => handleUpdateSelectedPlayer(genPlayerId(player)),
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

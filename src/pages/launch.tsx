import {
  Box,
  Button,
  Card,
  Center,
  HStack,
  IconButton,
  IconButtonProps,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Text,
  Tooltip,
  VStack,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { cloneElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowLeftRight, LuPlus, LuSettings } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { CompactButtonGroup } from "@/components/common/compact-button-group";
import InstancesView from "@/components/instances-view";
import PlayerAvatar from "@/components/player-avatar";
import PlayersView from "@/components/players-view";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { PlayerType } from "@/enums/account";
import { useThemedCSSStyle } from "@/hooks/themed-css";
import { Player } from "@/models/account";
import { InstanceSummary } from "@/models/instance/misc";
import styles from "@/styles/launch.module.css";

interface CustomButtonProps extends Omit<IconButtonProps, "onClick"> {
  tooltip: string;
  onClick: () => void;
  popoverContent: React.ReactElement;
  showAdd?: boolean;
  onAddClick?: () => void;
}

const ButtonWithPopover: React.FC<CustomButtonProps> = ({
  tooltip,
  popoverContent,
  onClick,
  showAdd = false,
  onAddClick,
  ...props
}) => {
  const { config } = useLauncherConfig();
  const quickSwitch = config.general.functionality.launchPageQuickSwitch;
  const { isOpen, onToggle, onClose } = useDisclosure();

  const [tooltipDisabled, setTooltipDisabled] = useState(false);

  // To use Popover and Tooltip together, refer to: https://github.com/chakra-ui/chakra-ui/issues/2843
  // However, when the Popover is closed, the Tooltip will wrongly show again.
  // To prevent this, we temporarily disable the Tooltip using a timeout.
  const handleClose = () => {
    setTooltipDisabled(true);
    onClose();
    setTimeout(() => setTooltipDisabled(false), 200);
  };

  return (
    <Popover
      isOpen={showAdd ? false : isOpen}
      onClose={handleClose}
      placement="top-end"
      gutter={12} // add more gutter to show clear space from the launch button's shadow
    >
      <Tooltip label={tooltip} placement="top-end" isDisabled={tooltipDisabled}>
        <Box>
          {/* anchor for Tooltip */}
          <PopoverTrigger>
            <IconButton
              size="xs"
              icon={showAdd ? <LuPlus /> : <LuArrowLeftRight />}
              {...props}
              onClick={() => {
                if (showAdd) return (onAddClick ?? onClick)();
                quickSwitch ? onToggle() : onClick();
              }}
            />
          </PopoverTrigger>
        </Box>
      </Tooltip>

      {!showAdd && (
        <PopoverContent maxH="3xs" overflow="auto">
          <PopoverBody p={0}>
            {cloneElement(popoverContent, {
              // Delay close after selecting an item for better UX.
              onSelectCallback: () => setTimeout(handleClose, 100),
            })}
          </PopoverBody>
        </PopoverContent>
      )}
    </Popover>
  );
};

const LaunchPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const themedStyles = useThemedCSSStyle();
  const { openSharedModal } = useSharedModals();

  const { selectedPlayer, getPlayerList, getInstanceList, selectedInstance } =
    useGlobalData();

  const [playerList, setPlayerList] = useState<Player[]>([]);
  const [instanceList, setInstanceList] = useState<InstanceSummary[]>([]);

  useEffect(() => {
    setPlayerList(getPlayerList() || []);
  }, [getPlayerList]);

  useEffect(() => {
    setInstanceList(getInstanceList() || []);
  }, [getInstanceList]);

  const hasPlayers = playerList.length > 0;
  const hasInstances = instanceList.length > 0;

  return (
    <HStack position="absolute" bottom={7} right={7} spacing={4}>
      <Card
        className={
          styles["selected-user-card"] + " " + themedStyles.card["card-back"]
        }
      >
        <Box position="absolute" top={1} right={1}>
          <ButtonWithPopover
            tooltip={t(
              `LaunchPage.SwitchButton.tooltip.${hasPlayers ? "switchPlayer" : "addPlayer"}`
            )}
            aria-label="player"
            variant="subtle"
            popoverContent={
              <PlayersView
                players={playerList}
                selectedPlayer={selectedPlayer}
                viewType="list"
                withMenu={false}
              />
            }
            onClick={() => router.push("/accounts")}
            showAdd={!hasPlayers}
            onAddClick={() => router.push("/accounts?add=true")}
          />
        </Box>

        <HStack spacing={2.5} h="100%" w="100%">
          {selectedPlayer ? (
            <>
              <PlayerAvatar
                boxSize="32px"
                objectFit="cover"
                avatar={selectedPlayer.avatar}
              />
              <VStack spacing={0} align="left" mt={-2} minW={0}>
                <Text
                  fontSize="xs-sm"
                  fontWeight="bold"
                  maxW="100%"
                  mt={2}
                  isTruncated
                >
                  {selectedPlayer.name}
                </Text>
                <Text fontSize="2xs" className="secondary-text">
                  {t(
                    `Enums.playerTypes.${selectedPlayer.playerType === PlayerType.ThirdParty ? "3rdpartyShort" : selectedPlayer.playerType}`
                  )}
                </Text>
                <Text fontSize="2xs" className="secondary-text">
                  {selectedPlayer.playerType === PlayerType.ThirdParty &&
                    selectedPlayer.authServer?.name}
                </Text>
              </VStack>
            </>
          ) : (
            <Center w="100%" h="100%">
              <Text fontSize="sm" className="secondary-text">
                {t("LaunchPage.Text.noSelectedPlayer")}
              </Text>
            </Center>
          )}
        </HStack>
      </Card>

      <Box position="relative">
        <Button
          id="main-launch-button"
          colorScheme="blackAlpha"
          className={styles["launch-button"]}
          onClick={() => {
            if (selectedInstance) {
              openSharedModal("launch", {
                instanceId: selectedInstance.id,
              });
            }
          }}
        >
          <VStack spacing={1.5} w="100%" color="white">
            <Text fontSize="lg" fontWeight="bold">
              {t("LaunchPage.button.launch")}
            </Text>
            <Text fontSize="sm" className="ellipsis-text">
              {selectedInstance
                ? selectedInstance.name
                : t("LaunchPage.Text.noSelectedGame")}
            </Text>
          </VStack>
        </Button>

        <Box position="absolute" top={1} right={1}>
          <CompactButtonGroup
            colorScheme={useColorModeValue("blackAlpha", "gray")}
            size="xs"
          >
            {selectedInstance && hasInstances && (
              <CommonIconButton
                icon={LuSettings}
                label={t("LaunchPage.button.instanceSettings")}
                tooltipPlacement="top"
                onClick={() =>
                  router.push(
                    `/instances/details/${encodeURIComponent(
                      selectedInstance.id
                    )}/settings`
                  )
                }
              />
            )}

            <ButtonWithPopover
              tooltip={t(
                `LaunchPage.SwitchButton.tooltip.${hasInstances ? "switchInstance" : "addInstance"}`
              )}
              aria-label="instance"
              popoverContent={
                <InstancesView
                  instances={instanceList}
                  viewType="list"
                  withMenu={false}
                />
              }
              onClick={() => router.push("/instances/list")}
              showAdd={!hasInstances}
              onAddClick={() => router.push("/instances/add-import")}
              mt={-1} // prevent margin caused by Tooltip
            />
          </CompactButtonGroup>
        </Box>
      </Box>
    </HStack>
  );
};

export default LaunchPage;

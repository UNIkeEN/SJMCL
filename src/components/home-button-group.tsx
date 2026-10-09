import {
  Box,
  Button,
  Center,
  Flex,
  HStack,
  IconButton,
  IconButtonProps,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Portal,
  Text,
  Tooltip,
  VStack,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { cloneElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowLeftRight, LuPlus, LuSettings } from "react-icons/lu";
import AdvancedCard from "@/components/common/advanced-card";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { CompactButtonGroup } from "@/components/common/compact-button-group";
import InstancesView from "@/components/instances-view";
import PlayerAvatar from "@/components/player-avatar";
import PlayersView from "@/components/players-view";
import LiquidGlassEffect from "@/components/special/liquid-glass-effect";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { PlayerType } from "@/enums/account";
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
      gutter={12}
    >
      <Tooltip label={tooltip} placement="top-end" isDisabled={tooltipDisabled}>
        <Box lineHeight={0}>
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
        <Portal>
          <PopoverContent maxH="3xs" overflow="auto">
            <PopoverBody p={0}>
              {cloneElement(popoverContent, {
                onSelectCallback: () => setTimeout(handleClose, 100),
              })}
            </PopoverBody>
          </PopoverContent>
        </Portal>
      )}
    </Popover>
  );
};

const HomeButtonGroup = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { openSharedModal } = useSharedModals();
  const { config } = useLauncherConfig();
  const useLiquidGlass = config.appearance.theme.useLiquidGlassDesign;
  const subtitleColor = useColorModeValue("gray.600", "gray.400");
  const { selectedPlayer, selectedInstance, getPlayerList, getInstanceList } =
    useGlobalData();

  const playerList = getPlayerList() || [];
  const instanceList = getInstanceList() || [];
  const hasPlayers = playerList.length > 0;
  const hasInstances = instanceList.length > 0;

  return (
    <Flex wrap="wrap" justify="flex-end" align="flex-end" gap={4}>
      <AdvancedCard
        className={styles["selected-user-card"]}
        data-liquid={useLiquidGlass}
      >
        <Box h="100%" p={3}>
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
                  <Text fontSize="2xs" color={subtitleColor} lineHeight={4}>
                    {t(
                      `Enums.playerTypes.${selectedPlayer.playerType === PlayerType.ThirdParty ? "3rdpartyShort" : selectedPlayer.playerType}`
                    )}
                  </Text>
                  <Text fontSize="2xs" color={subtitleColor} lineHeight={4}>
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
        </Box>
      </AdvancedCard>

      <Box position="relative">
        <Button
          id="main-launch-button"
          data-liquid={useLiquidGlass}
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
          {useLiquidGlass && <LiquidGlassEffect isDark />}
          <VStack
            spacing={1.5}
            w="100%"
            color="white"
            position="relative"
            zIndex={useLiquidGlass ? 3 : undefined}
          >
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
                  router.push({
                    pathname: "/instances/details/[id]/settings",
                    query: { id: selectedInstance.id },
                  })
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
                  selectedInstance={selectedInstance}
                  viewType="list"
                  withMenu={false}
                />
              }
              onClick={() => router.push("/instances/list")}
              showAdd={!hasInstances}
              onAddClick={() => router.push("/instances/add-import")}
            />
          </CompactButtonGroup>
        </Box>
      </Box>
    </Flex>
  );
};

export default HomeButtonGroup;

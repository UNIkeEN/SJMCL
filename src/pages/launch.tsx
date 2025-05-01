import {
  Box,
  Button,
  Card,
  Center,
  HStack,
  IconButton,
  IconButtonProps,
  Image,
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
import { LuArrowLeftRight } from "react-icons/lu";
import InstancesView from "@/components/instances-view";
import PlayersView from "@/components/players-view";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useThemedCSSStyle } from "@/hooks/themed-css";
import { Player } from "@/models/account";
import { InstanceSummary } from "@/models/instance/misc";
import styles from "@/styles/launch.module.css";
import { base64ImgSrc } from "@/utils/string";

interface SwitchButtonProps extends Omit<IconButtonProps, "onClick"> {
  tooltip: string;
  onClick: () => void;
  popoverContent: React.ReactElement;
}

const SwitchButton: React.FC<SwitchButtonProps> = ({
  tooltip,
  popoverContent,
  onClick,
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
      isOpen={isOpen}
      onClose={handleClose}
      placement="top-end"
      gutter={12} // add more gutter to show clear space from the launch button's shadow
    >
      <Tooltip label={tooltip} placement="top-end" isDisabled={tooltipDisabled}>
        <Box position="absolute" top={1} right={1}>
          <PopoverTrigger>
            <IconButton
              size="xs"
              icon={<LuArrowLeftRight />}
              {...props}
              onClick={() => {
                quickSwitch ? onToggle() : onClick();
              }}
            />
          </PopoverTrigger>
        </Box>
      </Tooltip>
      <PopoverContent maxH="3xs" overflow="auto">
        <PopoverBody p={0}>
          {cloneElement(popoverContent, {
            // Delay close after selecting an item for better UX.
            onSelectCallback: () => setTimeout(handleClose, 100),
          })}
        </PopoverBody>
      </PopoverContent>
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

  return (
    <HStack position="absolute" bottom={7} right={7} spacing={4}>
      <Card
        className={
          styles["selected-user-card"] + " " + themedStyles.card["card-back"]
        }
      >
        <SwitchButton
          tooltip={t("LaunchPage.SwitchButton.tooltip.switchPlayer")}
          aria-label="switch-player"
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
        />
        <HStack spacing={2.5} h="100%" w="100%">
          {selectedPlayer ? (
            <>
              <Image
                boxSize="32px"
                objectFit="cover"
                src={base64ImgSrc(selectedPlayer.avatar)}
                alt={selectedPlayer.name}
              />
              <VStack spacing={0} align="left" mt={-2}>
                <Text
                  fontSize="xs-sm"
                  className="no-select ellipsis-text"
                  fontWeight="bold"
                  w="100%"
                  mt={2}
                >
                  {selectedPlayer.name}
                </Text>
                <Text fontSize="2xs" className="secondary-text no-select">
                  {t(
                    `Enums.playerTypes.${selectedPlayer.playerType === "3rdparty" ? "3rdpartyShort" : selectedPlayer.playerType}`
                  )}
                </Text>
                <Text fontSize="2xs" className="secondary-text no-select">
                  {selectedPlayer.playerType === "3rdparty" &&
                    selectedPlayer.authServer?.name}
                </Text>
              </VStack>
            </>
          ) : (
            <Center w="100%" h="100%">
              <Text fontSize="sm" className="secondary-text no-select">
                {t("LaunchPage.Text.noSelectedPlayer")}
              </Text>
            </Center>
          )}
        </HStack>
      </Card>
      <Box position="relative">
        <Button
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

        <SwitchButton
          tooltip={t("LaunchPage.SwitchButton.tooltip.switchGame")}
          aria-label="switch-game"
          colorScheme={useColorModeValue("blackAlpha", "gray")}
          popoverContent={
            <InstancesView
              instances={instanceList}
              viewType="list"
              withMenu={false}
            />
          }
          onClick={() => router.push("/instances/all")}
        />
      </Box>
    </HStack>
  );
};

export default LaunchPage;

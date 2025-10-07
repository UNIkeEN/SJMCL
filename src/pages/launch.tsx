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
import { type CSSProperties, cloneElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowLeftRight, LuSettings } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { CompactButtonGroup } from "@/components/common/compact-button-group";
import InstancesView from "@/components/instances-view";
import PlayersView from "@/components/players-view";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { PlayerType } from "@/enums/account";
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
        <Box>
          {/* anchor for Tooltip */}
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

  const buttonTextColor = useColorModeValue("gray.900", "whiteAlpha.900");
  const buttonSubTextColor = useColorModeValue("gray.600", "whiteAlpha.700");
  const launchButtonBg = useColorModeValue(
    "rgba(255, 255, 255, 0.72)",
    "rgba(17, 23, 39, 0.72)"
  );
  const launchButtonHoverBg = useColorModeValue(
    "rgba(255, 255, 255, 0.82)",
    "rgba(20, 28, 46, 0.78)"
  );
  const launchButtonActiveBg = useColorModeValue(
    "rgba(250, 250, 250, 0.9)",
    "rgba(13, 18, 32, 0.82)"
  );
  const launchButtonBorder = useColorModeValue(
    "rgba(15, 23, 42, 0.16)",
    "rgba(255, 255, 255, 0.18)"
  );
  const launchButtonHoverBorder = useColorModeValue(
    "rgba(15, 23, 42, 0.28)",
    "rgba(255, 255, 255, 0.28)"
  );
  const launchButtonActiveBorder = useColorModeValue(
    "rgba(15, 23, 42, 0.35)",
    "rgba(255, 255, 255, 0.35)"
  );
  const launchButtonShadow = useColorModeValue(
    "0 12px 24px rgba(15, 23, 42, 0.15)",
    "0 16px 32px rgba(3, 8, 20, 0.35)"
  );
  const launchButtonHoverShadow = useColorModeValue(
    "0 14px 28px rgba(15, 23, 42, 0.19)",
    "0 18px 36px rgba(3, 8, 20, 0.4)"
  );
  const launchButtonActiveShadow = useColorModeValue(
    "0 6px 18px rgba(15, 23, 42, 0.2)",
    "0 10px 28px rgba(3, 8, 20, 0.45)"
  );
  const focusRingColor = useColorModeValue(
    "rgba(79, 70, 229, 0.35)",
    "rgba(191, 219, 254, 0.35)"
  );

  const launchButtonVars = {
    "--launch-button-bg": launchButtonBg,
    "--launch-button-border": launchButtonBorder,
    "--launch-button-hover-bg": launchButtonHoverBg,
    "--launch-button-hover-border": launchButtonHoverBorder,
    "--launch-button-active-bg": launchButtonActiveBg,
    "--launch-button-active-border": launchButtonActiveBorder,
    "--launch-button-shadow": launchButtonShadow,
    "--launch-button-hover-shadow": launchButtonHoverShadow,
    "--launch-button-active-shadow": launchButtonActiveShadow,
  } as CSSProperties;

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
        <Box position="absolute" top={1} right={1}>
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
        </Box>
        <HStack spacing={2.5} h="100%" w="100%">
          {selectedPlayer ? (
            <>
              <Image
                boxSize="32px"
                objectFit="cover"
                src={base64ImgSrc(selectedPlayer.avatar)}
                alt={selectedPlayer.name}
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
          className={styles["launch-button"]}
          style={launchButtonVars}
          bg="transparent"
          borderWidth="1px"
          borderColor="transparent"
          color={buttonTextColor}
          fontWeight={600}
          sx={{
            bg: "var(--launch-button-bg)",
            borderColor: "var(--launch-button-border)",
            boxShadow: "var(--launch-button-shadow)",
            transition:
              "background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
            _hover: {
              bg: "var(--launch-button-hover-bg)",
              borderColor: "var(--launch-button-hover-border)",
              boxShadow: "var(--launch-button-hover-shadow)",
            },
            _active: {
              bg: "var(--launch-button-active-bg)",
              borderColor: "var(--launch-button-active-border)",
              boxShadow: "var(--launch-button-active-shadow)",
            },
          }}
          _focusVisible={{
            outline: "none",
            boxShadow: `0 0 0 3px ${focusRingColor}, var(--launch-button-shadow)`,
          }}
          onClick={() => {
            if (selectedInstance) {
              openSharedModal("launch", {
                instanceId: selectedInstance.id,
              });
            }
          }}
        >
          <VStack spacing={1.5} w="100%">
            <Text fontSize="lg" fontWeight="bold">
              {t("LaunchPage.button.launch")}
            </Text>
            <Text
              fontSize="sm"
              className="ellipsis-text"
              color={buttonSubTextColor}
            >
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
            {selectedInstance && (
              <CommonIconButton
                icon={LuSettings}
                label={t("LaunchPage.button.instanceSettings")}
                tooltipPlacement="top"
                onClick={() =>
                  router.push(
                    `/instances/details/${encodeURIComponent(selectedInstance.id)}/settings`
                  )
                }
              />
            )}
            <SwitchButton
              tooltip={t("LaunchPage.SwitchButton.tooltip.switchGame")}
              aria-label="switch-game"
              popoverContent={
                <InstancesView
                  instances={instanceList}
                  viewType="list"
                  withMenu={false}
                />
              }
              onClick={() => router.push("/instances/list")}
              mt={-1} // prevent margin caused by Tooltip
            />
          </CompactButtonGroup>
        </Box>
      </Box>
    </HStack>
  );
};

export default LaunchPage;

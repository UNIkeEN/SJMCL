import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Image,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Portal,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowRight, LuChevronDown, LuPlus } from "react-icons/lu";
import InstancesView from "@/components/instances-view";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { formatTimeInterval } from "@/utils/datetime";
import { getInstanceIconSrc } from "@/utils/instance";

// easy-launcher home reference: docs/design/easy-launcher-home.html
// tokens: docs/design/DESIGN.md (light theme, ink borders, hard shadow, lime accent).

interface LaunchHomeProps {
  /** rendered as an overlay inside the stage panel (home widgets, if any) */
  widgetSlot?: ReactNode;
}

const LaunchHome = ({ widgetSlot }: LaunchHomeProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { openSharedModal } = useSharedModals();
  const { bgImageSrc } = useLauncherConfig();
  const { selectedInstance, getInstanceList } = useGlobalData();

  const instanceList = getInstanceList() || [];
  const noInstance = !selectedInstance;

  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleLaunch = () => {
    if (selectedInstance) {
      openSharedModal("launch", { instanceId: selectedInstance.id });
    }
  };

  const instanceSpecs = selectedInstance
    ? [
        {
          label: t("LaunchPage.stats.loader"),
          value: [
            selectedInstance.modLoader.loaderType,
            selectedInstance.modLoader.version,
          ]
            .filter(Boolean)
            .join(" "),
        },
        {
          label: t("InstanceWidgets.basicInfo.gameVersion"),
          value: selectedInstance.version,
        },
        {
          label: t("InstanceWidgets.basicInfo.playTime"),
          value: formatTimeInterval(selectedInstance.playTime || 0),
        },
      ]
    : [];

  return (
    <Flex w="100%" h="100%" gap={8} align="stretch" px={10} py={6}>
      {/* stage: background panel with stats card */}
      <Box
        flex="1"
        minW="0"
        position="relative"
        backgroundColor="surface"
        bgImg={`url('${bgImageSrc}')`}
        bgSize="cover"
        bgPosition="center"
        border="2px solid"
        borderColor="ink"
        borderRadius="el-lg"
        overflow="hidden"
      >
        {widgetSlot && (
          <Box
            position="absolute"
            top={4}
            right={4}
            maxH={{ base: "55%", lg: "calc(100% - 96px)" }}
            overflow="hidden"
          >
            {widgetSlot}
          </Box>
        )}
        <Box
          position="absolute"
          left={5}
          bottom={5}
          bg="ground"
          border="2px solid"
          borderColor="ink"
          borderRadius="el-md"
          px={6}
          py={3}
        >
          <HStack spacing={8}>
            <VStack spacing={1} align="flex-start">
              <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.03em">
                {selectedInstance
                  ? [
                      selectedInstance.modLoader.loaderType,
                      selectedInstance.version,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : "-"}
              </Text>
              <Text fontSize="sm" fontWeight="600" color="muted">
                {t("InstanceWidgets.basicInfo.gameVersion")}
              </Text>
            </VStack>
            <VStack spacing={1} align="flex-start">
              <Text fontSize="2xl" fontWeight="800" letterSpacing="-0.03em">
                {selectedInstance
                  ? formatTimeInterval(selectedInstance.playTime || 0)
                  : "-"}
              </Text>
              <Text fontSize="sm" fontWeight="600" color="muted">
                {t("InstanceWidgets.basicInfo.playTime")}
              </Text>
            </VStack>
          </HStack>
        </Box>
      </Box>

      {/* side panel: profile picker, detail card, launch button */}
      <Flex w="380px" flexShrink={0} direction="column" gap={3.5} h="100%">
        {/* instance picker */}
        <Popover
          isOpen={isOpen}
          onClose={onClose}
          placement="bottom-start"
          gutter={4}
        >
          <PopoverTrigger>
            <Button
              w="100%"
              h="auto"
              py={3}
              px={5}
              justifyContent="space-between"
              backgroundColor="surface"
              border="2px solid"
              borderColor="ink"
              borderRadius="el-md"
              textAlign="left"
              _hover={{ backgroundColor: "surface" }}
              _active={{ backgroundColor: "surface" }}
              aria-expanded={isOpen}
              onClick={onOpen}
            >
              <HStack spacing={3} overflow="hidden">
                {selectedInstance && (
                  <Image
                    boxSize="34px"
                    src={getInstanceIconSrc(
                      selectedInstance.iconSrc,
                      selectedInstance.versionPath
                    )}
                    alt={selectedInstance.name}
                    fallbackSrc="/images/icons/JEIcon_Release.png"
                  />
                )}
                <VStack spacing={0} align="flex-start" minW={0}>
                  <Text
                    fontWeight="700"
                    fontSize="md"
                    maxW="100%"
                    isTruncated
                    m={0}
                  >
                    {selectedInstance?.name ??
                      t("LaunchPage.Text.noSelectedGame")}
                  </Text>
                  {selectedInstance && (
                    <Text fontSize="sm" fontWeight="600" color="muted">
                      {[
                        selectedInstance.modLoader.loaderType,
                        selectedInstance.version,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </Text>
                  )}
                </VStack>
              </HStack>
              <Icon
                as={LuChevronDown}
                boxSize={5}
                transform={isOpen ? "rotate(180deg)" : undefined}
                transition="transform .15s"
              />
            </Button>
          </PopoverTrigger>
          <Portal>
            <PopoverContent
              maxH={{ base: "60vh", lg: "3xs" }}
              overflow="auto"
              backgroundColor="ground"
              border="2px solid"
              borderColor="ink"
              borderRadius="el-md"
              boxShadow="shadow-hard"
            >
              <PopoverBody p={2}>
                <InstancesView
                  instances={instanceList}
                  selectedInstance={selectedInstance}
                  viewType="list"
                  withMenu={false}
                  onSelectCallback={() => onClose()}
                />
              </PopoverBody>
            </PopoverContent>
          </Portal>
        </Popover>

        {/* dark detail card */}
        <Box
          flex="1"
          bg="ink"
          color="onInk"
          border="2px solid"
          borderColor="ink"
          borderRadius="el-lg"
          px={6}
          py={5}
          minH="180px"
          overflow="hidden"
        >
          <Text
            fontSize="3xl"
            fontWeight="800"
            letterSpacing="-0.03em"
            lineHeight="1.05"
          >
            {selectedInstance?.name ?? t("LaunchPage.Text.noSelectedGame")}
          </Text>
          {instanceSpecs.map((spec) => (
            <Flex
              key={spec.label}
              justify="space-between"
              py={2.5}
              borderBottom="1px dashed"
              borderColor="onInkMuted"
              fontSize="sm"
            >
              <Text color="onInkMuted" fontWeight="500">
                {spec.label}
              </Text>
              <Text fontWeight="700" isTruncated ml={4}>
                {spec.value}
              </Text>
            </Flex>
          ))}
          {noInstance && (
            <Button
              mt={6}
              leftIcon={<LuPlus />}
              size="sm"
              backgroundColor="transparent"
              border="2px solid"
              borderColor="onInkMuted"
              color="onInk"
              borderRadius="14px"
              onClick={() => router.push("/instances/add-import")}
            >
              {t("LaunchPage.Text.noSelectedGame")}
            </Button>
          )}
        </Box>

        {/* big play button */}
        <Button
          h="84px"
          backgroundColor="accent"
          border="3px solid"
          borderColor="ink"
          borderRadius="28px"
          boxShadow="shadow-hard"
          justifyContent="space-between"
          px={8}
          onClick={handleLaunch}
          isDisabled={noInstance}
          color="ink"
          _hover={{
            transform: "translate(2px, 2px)",
            boxShadow: "4px 4px 0 ink",
            backgroundColor: "accent",
          }}
          _active={{
            transform: "translate(6px, 6px)",
            boxShadow: "0 0 0 ink",
            backgroundColor: "accent",
          }}
          _disabled={{ opacity: 0.55, cursor: "not-allowed" }}
          aria-label={t("LaunchPage.button.launch")}
        >
          <Text fontSize="3xl" fontWeight="800" letterSpacing="-0.03em">
            {t("LaunchPage.button.launch")}
          </Text>
          <HStack
            boxSize="52px"
            borderRadius="50%"
            backgroundColor="ink"
            color="accent"
            justify="center"
          >
            <Icon as={LuArrowRight} boxSize={6} aria-hidden />
          </HStack>
        </Button>
      </Flex>
    </Flex>
  );
};

export default LaunchHome;

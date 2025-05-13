import { Box, Flex, HStack, Text, VStack } from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import MultiLevelProgressBar from "@/components/common/multi-level-progress";
import { useLauncherConfig } from "@/contexts/config";
import { MemoryInfo } from "@/models/system-info";

interface MemoryStatusProgressProps {
  memoryInfo: MemoryInfo;
  allocatedMemory?: number; // in MB
}

const MemoryStatusProgress: React.FC<MemoryStatusProgressProps> = ({
  memoryInfo,
  allocatedMemory = 0,
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const { total, used } = memoryInfo;
  const usedPercentage = total > 0 ? (used / total) * 100 : 0;
  const allocatedPercentage =
    total > 0 ? ((allocatedMemory * 1024 * 1024) / total) * 100 : 0;

  const totalInGB = (total / 1024 / 1024 / 1024).toFixed(2);
  const usedInGB = (used / 1024 / 1024 / 1024).toFixed(2);
  const allocatedInGB = (allocatedMemory / 1024).toFixed(2);

  return (
    <VStack align="stretch" spacing={2}>
      <Flex align="baseline">
        <Text fontSize="xs-sm">{t("MemoryStatusProgress.title")}</Text>
        <Text fontSize="xs-sm" ml="auto" className="secondary-text">
          {t("MemoryStatusProgress.info", {
            total: totalInGB,
            used: usedInGB,
            allocated: allocatedInGB,
          })}
        </Text>
      </Flex>
      <MultiLevelProgressBar
        value={[usedPercentage, allocatedPercentage]}
        colorScheme={primaryColor}
        borderRadius="sm"
      />
      <HStack spacing={1}>
        <Box bgColor={`${primaryColor}.500`} w={2} h={2} borderRadius="full" />
        <Text fontSize="xs" className="secondary-text">
          {t("MemoryStatusProgress.label.now")}
        </Text>
        <Box
          bgColor={`${primaryColor}.300`}
          w={2}
          h={2}
          ml={1}
          borderRadius="full"
        />
        <Text fontSize="xs" className="secondary-text">
          {t("MemoryStatusProgress.label.maxAllocation")}
        </Text>
      </HStack>
    </VStack>
  );
};

export default MemoryStatusProgress;

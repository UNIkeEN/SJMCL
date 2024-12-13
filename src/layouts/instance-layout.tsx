import { Box, Grid, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";
import SelectableButton from "@/components/common/selectable-button";
import { useData } from "@/contexts/data";

const InstanceLayout: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { gameInstanceSummaryList } = useData();

  // Extract the current instance ID from the route
  const instanceId = Number(router.query.id);
  const currentInstance = gameInstanceSummaryList.find(
    (instance) => instance.id === instanceId
  );

  if (!currentInstance) {
    return (
      <Box>
        <Text>{t("InstancePage.error.instanceNotFound")}</Text>
      </Box>
    );
  }

  return (
    <Grid templateRows="auto 1fr" h="100%" p={4}>
      <Box>
        <VStack align="left" spacing={4}>
          <SelectableButton
            isSelected={router.asPath === `/games/instance/${instanceId}/home`}
            onClick={() => router.push(`/games/instance/${instanceId}/home`)}
          >
            <HStack spacing={2}>
              <Text fontSize="sm">{t("InstancePage.tabs.home")}</Text>
            </HStack>
          </SelectableButton>
        </VStack>
      </Box>
      <Box p={4}>
        <VStack align="start" spacing={4}>
          <Text fontSize="lg" fontWeight="bold">
            {currentInstance.name}
          </Text>
          {/* Add more details about the instance here */}
        </VStack>
      </Box>
    </Grid>
  );
};

export default InstanceLayout;

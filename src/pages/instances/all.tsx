import { Box, Button, HStack, Icon } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuLayoutGrid, LuLayoutList, LuPlay, LuPlus } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { Section } from "@/components/common/section";
import SegmentedControl from "@/components/common/segmented";
import InstancesView from "@/components/instances-view";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { InstanceSummary } from "@/models/instance/misc";

const AllInstancesPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const selectedViewType = config.states.allInstancesPage.viewType;
  const { openSharedModal } = useSharedModals();

  const { selectedInstance, getInstanceList } = useGlobalData();
  const [instanceList, setInstanceList] = useState<InstanceSummary[]>([]);

  useEffect(() => {
    setInstanceList(getInstanceList() || []);
  }, [getInstanceList]);

  const viewTypeList = [
    {
      key: "grid",
      icon: LuLayoutGrid,
      tooltip: t("AllInstancesPage.viewTypeList.grid"),
    },
    {
      key: "list",
      icon: LuLayoutList,
      tooltip: t("AllInstancesPage.viewTypeList.list"),
    },
  ];

  return (
    <Section
      display="flex"
      flexDirection="column"
      height="100%"
      title={t("AllInstancesPage.title")}
      headExtra={
        <HStack spacing={2}>
          <CommonIconButton
            icon="refresh"
            size="xs"
            fontSize="sm"
            onClick={() => {
              setInstanceList(getInstanceList(true) || []);
            }}
          />
          <SegmentedControl
            selected={selectedViewType}
            onSelectItem={(s) => {
              update("states.allInstancesPage.viewType", s as string);
            }}
            size="2xs"
            ml={1}
            items={viewTypeList.map((item) => ({
              ...item,
              value: item.key,
              label: <Icon as={item.icon} />,
            }))}
            withTooltip
          />
          <Button
            leftIcon={<LuPlus />}
            size="xs"
            colorScheme={primaryColor}
            variant={primaryColor === "gray" ? "subtle" : "outline"}
            onClick={() => {
              router.push("/instances/add-import");
            }}
          >
            {t("AllInstancesPage.button.addAndImport")}
          </Button>
          <Button
            leftIcon={<LuPlay />}
            size="xs"
            colorScheme={primaryColor}
            isDisabled={!selectedInstance}
            onClick={() => {
              if (selectedInstance) {
                openSharedModal("launch", {
                  instanceId: selectedInstance.id,
                });
              }
            }}
          >
            {t("AllInstancesPage.button.launch")}
          </Button>
        </HStack>
      }
    >
      <Box overflow="auto" flexGrow={1} rounded="md">
        <InstancesView instances={instanceList} viewType={selectedViewType} />
      </Box>
    </Section>
  );
};

export default AllInstancesPage;

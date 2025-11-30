import {
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuArrowDown01,
  LuArrowDown10,
  LuArrowDownAZ,
  LuLayoutGrid,
  LuLayoutList,
  LuListFilter,
  LuPlay,
  LuPlus,
} from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { Section } from "@/components/common/section";
import SegmentedControl from "@/components/common/segmented";
import InstancesView from "@/components/instances-view";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { InstanceSummary } from "@/models/instance/misc";
import { getGameDirName } from "@/utils/instance";

const InstanceListPage = () => {
  const router = useRouter();
  const { dir } = router.query;
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const selectedViewType = config.states.allInstancesPage.viewType;
  const selectedSortByType = config.states.allInstancesPage.sortBy;

  const { openSharedModal } = useSharedModals();
  const { selectedInstance, getInstanceList } = useGlobalData();
  const [instanceList, setInstanceList] = useState<InstanceSummary[]>([]);

  useEffect(() => {
    if (!router.isReady) return;

    setInstanceList(() => {
      const all = getInstanceList() || [];
      if (!dir) return all; // /instances/list, show all
      const dirPrefix = Array.isArray(dir) ? dir.join("/") : dir;
      return all.filter((inst) => inst.id.startsWith(`${dirPrefix}:`));
    });
  }, [dir, router.isReady, getInstanceList]);

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

  const sortByTypeList = [
    {
      key: "versionAsc",
      icon: <LuArrowDown01 />,
    },
    {
      key: "versionDesc",
      icon: <LuArrowDown10 />,
    },
    {
      key: "name",
      icon: <LuArrowDownAZ />,
    },
  ];

  const FilterAndSortMenu = () => (
    <Menu>
      <Tooltip label={t("AllInstancesPage.button.sortAndFilter")}>
        <MenuButton
          as={IconButton}
          size="xs"
          fontSize="sm"
          variant="ghost"
          icon={<LuListFilter />}
        ></MenuButton>
      </Tooltip>
      <MenuList>
        <MenuOptionGroup
          title={t("AllInstancesPage.sortBy")}
          type="radio"
          value={selectedSortByType}
          onChange={(s) => {
            update("states.allInstancesPage.sortBy", s as string);
            getInstanceList(true);
          }}
        >
          {sortByTypeList.map((item) => (
            <MenuItemOption key={item.key} value={item.key} fontSize="xs">
              <HStack spacing={2}>
                {item.icon}
                <Text>{t(`AllInstancesPage.sortByTypeList.${item.key}`)}</Text>
              </HStack>
            </MenuItemOption>
          ))}
        </MenuOptionGroup>
      </MenuList>
    </Menu>
  );

  return (
    <Section
      display="flex"
      flexDirection="column"
      height="100%"
      title={getGameDirName(
        Array.isArray(dir) ? dir.join("/") : dir || t("AllInstancesPage.title")
      )}
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
          <FilterAndSortMenu />
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

export default InstanceListPage;

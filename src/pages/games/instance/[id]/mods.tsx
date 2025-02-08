import {
  Avatar,
  AvatarBadge,
  HStack,
  IconButton,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCircleCheck,
  LuCircleMinus,
  LuFolderOpen,
  LuInfo,
  LuTriangleAlert,
} from "react-icons/lu";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import ModLoaderCards from "@/components/mod-loader-cards";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { LocalModInfo } from "@/models/game-instance";
import { mockLocalMods } from "@/models/mock/game-instance";

const InstanceModsPage = () => {
  const { t } = useTranslation();
  const { summary } = useInstanceSharedData();
  const { config, update } = useLauncherConfig();
  const accordionState = config.states.instanceModsPage.modsAccordionState;

  const [localMods, setLocalMods] = useState<LocalModInfo[]>([]);

  useEffect(() => {
    // only for mock
    setLocalMods(mockLocalMods);
  }, []);

  const modMenuOperations = (mod: LocalModInfo) => [
    ...(mod.potentialIncompatibility
      ? [
          {
            key: "alert",
            localesKey: "InstanceModsPage.modList.menu.alert",
            icon: LuTriangleAlert,
            danger: true,
            onClick: () => {},
          },
        ]
      : []),
    {
      key: "switch",
      localesKey: mod.enabled ? "General.disable" : "General.enable",
      icon: mod.enabled ? LuCircleMinus : LuCircleCheck,
      danger: false,
      onClick: () => {
        // TBD, only mock operation in frontend
        setLocalMods((prevMods) =>
          prevMods.map((prev) =>
            prev.fileName === mod.fileName
              ? { ...prev, enabled: !prev.enabled }
              : prev
          )
        );
      },
    },
    {
      key: "openFolder",
      localesKey: "General.openFolder",
      icon: LuFolderOpen,
      danger: false,
      onClick: () => {},
    },
    {
      key: "info",
      localesKey: "InstanceModsPage.modList.menu.info",
      icon: LuInfo,
      danger: false,
      onClick: () => {},
    },
  ];

  return (
    <>
      <Section
        title={t("InstanceModsPage.modLoaderList.title")}
        isAccordion
        initialIsOpen={accordionState[0]}
        onClick={() => {
          update("states.instanceModsPage.modsAccordionState", [
            !accordionState[0],
            accordionState[1],
          ]);
        }}
      >
        <ModLoaderCards
          currentType={summary?.modLoader.type || "none"}
          currentVersion={summary?.modLoader.version}
          displayMode="entry"
        />
      </Section>
      <Section
        title={t("InstanceModsPage.modList.title")}
        isAccordion
        initialIsOpen={accordionState[1]}
        titleExtra={<CountTag count={localMods.length} />}
        onClick={() => {
          update("states.instanceModsPage.modsAccordionState", [
            accordionState[0],
            !accordionState[1],
          ]);
        }}
      >
        {localMods.length > 0 ? (
          <OptionItemGroup
            items={localMods.map((mod) => (
              <OptionItem
                key={mod.fileName} // unique
                childrenOnHover
                title={
                  mod.transltedName
                    ? `${mod.transltedName}｜${mod.name}`
                    : mod.name
                }
                titleExtra={
                  <Text fontSize="xs" className="secondary-text no-select">
                    {mod.version}
                  </Text>
                }
                description={
                  <Text
                    fontSize="xs"
                    overflow="hidden"
                    className="secondary-text no-select ellipsis-text" // only show one line
                  >
                    {`${mod.fileName}: ${mod.description}`}
                  </Text>
                }
                prefixElement={
                  <Avatar
                    src={mod.iconSrc}
                    name={mod.name}
                    boxSize="28px"
                    borderRadius="4px"
                    style={{
                      filter: mod.enabled ? "none" : "grayscale(90%)",
                    }}
                  >
                    <AvatarBadge
                      bg={mod.enabled ? "green" : "gray"}
                      boxSize="0.75em"
                      borderWidth={2}
                    />
                  </Avatar>
                }
              >
                <HStack spacing={0}>
                  {modMenuOperations(mod).map((item) => (
                    <Tooltip label={t(item.localesKey)} key={item.key}>
                      <IconButton
                        size="sm"
                        aria-label={item.key}
                        icon={<item.icon />}
                        variant="ghost"
                        colorScheme={item.danger ? "red" : "gray"}
                        onClick={item.onClick}
                      />
                    </Tooltip>
                  ))}
                </HStack>
              </OptionItem>
            ))}
          />
        ) : (
          <Empty withIcon={false} size="sm" />
        )}
      </Section>
    </>
  );
};

export default InstanceModsPage;

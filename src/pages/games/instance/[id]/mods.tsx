import { Avatar, AvatarBadge, HStack, Tag, Text } from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCircleCheck,
  LuCircleMinus,
  LuClockArrowUp,
  LuSearch,
  LuTriangleAlert,
} from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import ModLoaderCards from "@/components/mod-loader-cards";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { InstanceSubdirEnums } from "@/enums/instance";
import { LocalModInfo } from "@/models/instance";
import { base64ImgSrc } from "@/utils/string";

const InstanceModsPage = () => {
  const { t } = useTranslation();
  const { summary, openSubdir, getLocalModList } = useInstanceSharedData();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const accordionStates = config.states.instanceModsPage.accordionStates;

  const [localMods, setLocalMods] = useState<LocalModInfo[]>([]);

  useEffect(() => {
    setLocalMods(getLocalModList() || []);
  }, [getLocalModList]);

  const modSecMenuOperations = [
    {
      icon: "openFolder",
      onClick: () => {
        openSubdir(InstanceSubdirEnums.Mods);
      },
    },
    {
      icon: "add",
      onClick: () => {},
    },
    {
      icon: "download",
      onClick: () => {},
    },
    {
      icon: LuClockArrowUp,
      label: t("InstanceModsPage.modList.menu.update"),
      onClick: () => {},
    },
    {
      icon: LuSearch,
      label: "search",
      onClick: () => {},
    },
    {
      icon: "refresh",
      onClick: () => {
        setLocalMods(getLocalModList(true) || []);
      },
    },
  ];

  const modItemMenuOperations = (mod: LocalModInfo) => [
    ...(mod.potentialIncompatibility
      ? [
          {
            label: t("InstanceModsPage.modList.menu.alert"),
            icon: LuTriangleAlert,
            danger: true,
            onClick: () => {},
          },
        ]
      : []),
    {
      label: t(mod.enabled ? "General.disable" : "General.enable"),
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
      label: "",
      icon: "revealFile", // use common-icon-button predefined icon
      danger: false,
      onClick: () => {
        revealItemInDir(mod.filePath);
      },
    },
    {
      label: t("InstanceModsPage.modList.menu.info"),
      icon: "info",
      danger: false,
      onClick: () => {},
    },
  ];

  return (
    <>
      <Section
        title={t("InstanceModsPage.modLoaderList.title")}
        isAccordion
        initialIsOpen={accordionStates[0]}
        onAccordionToggle={(isOpen) => {
          update(
            "states.instanceModsPage.accordionStates",
            accordionStates.toSpliced(0, 1, isOpen)
          );
        }}
      >
        <ModLoaderCards
          currentType={summary?.modLoader.loaderType || "Unknown"}
          currentVersion={summary?.modLoader.version}
          displayMode="entry"
        />
      </Section>
      <Section
        title={t("InstanceModsPage.modList.title")}
        isAccordion
        initialIsOpen={accordionStates[1]}
        titleExtra={<CountTag count={localMods.length} />}
        onAccordionToggle={(isOpen) => {
          update(
            "states.instanceModsPage.accordionStates",
            accordionStates.toSpliced(1, 1, isOpen)
          );
        }}
        headExtra={
          <HStack spacing={2}>
            {modSecMenuOperations.map((btn, index) => (
              <CommonIconButton
                key={index}
                icon={btn.icon}
                label={btn.label}
                onClick={btn.onClick}
                size="xs"
                fontSize="sm"
                h={21}
              />
            ))}
          </HStack>
        }
      >
        {localMods.length > 0 ? (
          <OptionItemGroup
            items={localMods.map((mod) => (
              <OptionItem
                key={mod.fileName} // unique
                childrenOnHover
                title={
                  mod.translatedName
                    ? `${mod.translatedName}｜${mod.name}`
                    : mod.name
                }
                titleExtra={
                  <HStack>
                    <Text fontSize="xs" className="secondary-text no-select">
                      {mod.version}
                    </Text>
                    <Tag colorScheme={primaryColor} className="tag-xs">
                      {mod.loaderType}
                    </Tag>
                  </HStack>
                }
                description={
                  <Text
                    fontSize="xs"
                    overflow="hidden"
                    className="secondary-text no-select ellipsis-text" // only show one line
                  >
                    {`${mod.fileName.replace(/(\.jar|\.jar\.disabled)$/, "")}: ${mod.description}`}
                  </Text>
                }
                prefixElement={
                  <Avatar
                    src={base64ImgSrc(mod.iconSrc)}
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
                  {modItemMenuOperations(mod).map((item, index) => (
                    <CommonIconButton
                      key={index}
                      icon={item.icon}
                      label={item.label}
                      colorScheme={item.danger ? "red" : "gray"}
                      onClick={item.onClick}
                    />
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

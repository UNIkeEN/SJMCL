import { IconButton, Image, Tooltip } from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFolderOpen } from "react-icons/lu";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { ResourcePacksInfo } from "@/models/game-instance";
import { mockResourcePacks } from "@/models/mock/game-instance";

const InstanceResourcePacksPage = () => {
  const [resourcePacks, setResourcePacks] = useState<ResourcePacksInfo[]>([]);
  const [serverResPacks, setServerResPacks] = useState<ResourcePacksInfo[]>([]);
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const accordionState =
    config.states.instanceResourcepackPage.accordionState;

  useEffect(() => {
    setResourcePacks(mockResourcePacks);
    setServerResPacks(mockResourcePacks);
  }, []);

  const defaultIcon = "/images/icons/DefaultPack.webp";

  const renderSections = {
    global: {
      data: resourcePacks,
      locale: "resourcePackList",
    },
    server: {
      data: serverResPacks,
      locale: "serverResPackList",
    },
  };

  return (
    <>
      {Object.entries(renderSections).map(([key, value],index) => {
        return (
          <Section
            key={key}
            title={t(`InstanceResourcePacksPage.${value.locale}.title`)}
            isAccordion
            initialIsOpen={accordionState[index]}
            titleExtra={<CountTag count={value.data.length} />}
            onClick={() => {
              update(
                "states.instanceResourcepackPage.accordionState",
                index
                  ? [accordionState[0], !accordionState[1]]
                  : [!accordionState[0], accordionState[1]]
              );
            }}
          >
            {value.data.length > 0 ? (
              <OptionItemGroup
                items={value.data.map((pack) => (
                  <OptionItem
                    key={pack.name}
                    title={pack.name}
                    description={pack.description}
                    prefixElement={
                      <Image
                        src={pack.iconSrc || defaultIcon}
                        alt={pack.name}
                        boxSize="28px"
                        style={{ borderRadius: "4px" }}
                        onError={(e) => {
                          e.currentTarget.src = defaultIcon;
                        }}
                      />
                    }
                  >
                    <Tooltip label={t("General.openFolder")}>
                      <IconButton
                        aria-label={t("General.openFolder")}
                        icon={<LuFolderOpen />}
                        variant="ghost"
                        size="sm"
                        onClick={() => open(pack.fileDir)}
                      />
                    </Tooltip>
                  </OptionItem>
                ))}
              />
            ) : (
              <Empty withIcon={false} size="sm" />
            )}
          </Section>
        );
      })}
    </>
  );
};

export default InstanceResourcePacksPage;

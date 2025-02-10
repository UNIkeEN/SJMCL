import { HStack, Image } from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CommonIconButton } from "@/components/common/common-icon-button";
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
  const accordionStates =
    config.states.instanceResourcepackPage.accordionStates;

  useEffect(() => {
    setResourcePacks(mockResourcePacks);
    setServerResPacks(mockResourcePacks);
  }, []);

  const defaultIcon = "/images/icons/DefaultPack.webp";

  const handleRefresh = useCallback(() => {
    setResourcePacks(mockResourcePacks);
    setServerResPacks(mockResourcePacks);
  }, []);

  const renderSections = {
    global: {
      data: resourcePacks,
      locale: "resourcePackList",
      resourcePackSecMenuOperations: [
        {
          icon: "openFolder",
          onClick: () => {},
        },
        {
          icon: "download",
          label: t("JavaSettingsPage.javaList.download"),
        },
        {
          icon: "refresh",
          onClick: handleRefresh,
        },
      ],
    },
    server: {
      data: serverResPacks,
      locale: "serverResPackList",
      resourcePackSecMenuOperations: [
        {
          icon: "openFolder",
          onClick: () => {},
        },
      ],
    },
  };

  return (
    <>
      {Object.entries(renderSections).map(([key, value], index) => {
        return (
          <Section
            key={key}
            title={t(`InstanceResourcePacksPage.${value.locale}.title`)}
            isAccordion
            initialIsOpen={accordionStates[index]}
            titleExtra={<CountTag count={value.data.length} />}
            onAccordionToggle={(isOpen) => {
              update(
                "states.instanceResourcepackPage.accordionStates",
                accordionStates.toSpliced(index, 1, isOpen)
              );
            }}
            headExtra={
              <HStack spacing={2}>
                {value.resourcePackSecMenuOperations.map((btn, index) => (
                  <CommonIconButton
                    key={index}
                    icon={btn.icon}
                    size="xs"
                    fontSize="sm"
                    h={21}
                    onClick={btn.onClick}
                  />
                ))}
              </HStack>
            }
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
                    <CommonIconButton
                      icon="revealFile"
                      onClick={() => revealItemInDir(pack.filePath)}
                    />
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

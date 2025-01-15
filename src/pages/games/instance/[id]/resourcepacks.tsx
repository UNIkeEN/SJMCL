import { IconButton, Image, Tooltip } from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFolderOpen } from "react-icons/lu";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { ResourcePacksInfo } from "@/models/game-instance";
import { mockResourcePacks } from "@/models/mock/game-instance";

const InstanceResourcePacksPage = () => {
  const [resourcePacks, setResourcePacks] = useState<ResourcePacksInfo[]>([]);
  const [serverResPacks, setServerResPacks] = useState<ResourcePacksInfo[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    setResourcePacks(mockResourcePacks);
    setServerResPacks(mockResourcePacks);
  }, []);

  const defaultIcon = "/images/icons/DefaultPack.webp";

  const renderSections = {
    global: {
      data: resourcePacks,
      locale: "resourcePackList",
      initIsOpen: true,
    },
    server: {
      data: serverResPacks,
      locale: "serverResPackList",
      initIsOpen: false,
    },
  };

  return (
    <>
      {Object.entries(renderSections).map(([key, value]) => {
        return (
          <Section
            key={key}
            title={t(`InstanceResourcePacksPage.${value.locale}.title`)}
            isAccordion
            initialIsOpen={value.initIsOpen}
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
                        src={pack.iconUrl || defaultIcon}
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

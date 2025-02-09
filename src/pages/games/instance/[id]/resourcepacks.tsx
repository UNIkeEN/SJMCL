import { Image } from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
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
            titleExtra={<CountTag count={value.data.length} />}
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

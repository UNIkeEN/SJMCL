import { revealItemInDir } from "@tauri-apps/plugin-opener";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { ShaderPacksInfo } from "@/models/game-instance";
import { mockShaderPacks } from "@/models/mock/game-instance";

const InstanceShaderPacksPage = () => {
  const [shaderPacks, setShaderPacks] = useState<ShaderPacksInfo[]>([]);
  const { t } = useTranslation();

  const handleRefresh = useCallback(() => {
    setShaderPacks(mockShaderPacks);
  }, []);

  useEffect(() => {
    setShaderPacks(mockShaderPacks);
  }, []);

  const shaderPackSecMenuOperations = [
    {
      icon: "openFolder",
      label: t("General.openFolder"),
      onClick: () => {
        if (shaderPacks.length > 0) {
          revealItemInDir(shaderPacks[0].filePath);
        }
      },
    },
    {
      icon: "refresh",
      label: t("General.refresh"),
      onClick: () => {
        setShaderPacks(mockShaderPacks);
        handleRefresh();
      },
    },
  ];

  return (
    <Section
      title={t("InstanceShaderPacksPage.shaderPackList.title")}
      titleExtra={<CountTag count={shaderPacks.length} />}
      headExtra={
        <div>
          {shaderPackSecMenuOperations.map((btn, index) => (
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
        </div>
      }
    >
      {shaderPacks.length > 0 ? (
        <OptionItemGroup
          items={shaderPacks.map((pack) => (
            <OptionItem key={pack.name} title={pack.name}>
              <CommonIconButton
                icon="revealFile"
                onClick={() => revealItemInDir(pack.filePath)}
                h={18}
              />
            </OptionItem>
          ))}
        />
      ) : (
        <Empty withIcon={false} size="sm" />
      )}
    </Section>
  );
};

export default InstanceShaderPacksPage;

import { revealItemInDir } from "@tauri-apps/plugin-opener";
import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    setShaderPacks(mockShaderPacks);
  }, []);

  return (
    <Section
      title={t("InstanceShaderPacksPage.shaderPackList.title")}
      titleExtra={<CountTag count={shaderPacks.length} />}
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

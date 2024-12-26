import { IconButton, Tooltip } from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-shell";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFolderOpen } from "react-icons/lu";
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
    <Section title={t("InstanceShaderPacksPage.shaderPackList.title")}>
      {shaderPacks.length > 0 ? (
        <OptionItemGroup
          items={shaderPacks.map((pack) => (
            <OptionItem key={pack.name} title={pack.name}>
              <Tooltip label={t("General.openFolder")}>
                <IconButton
                  aria-label={t("General.openFolder")}
                  icon={<LuFolderOpen />}
                  variant="ghost"
                  size="sm"
                  h={18}
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
};

export default InstanceShaderPacksPage;

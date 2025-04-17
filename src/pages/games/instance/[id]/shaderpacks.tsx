import { HStack } from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useInstanceSharedData } from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { InstanceSubdirEnums } from "@/enums/instance";
import { ShaderPackInfo } from "@/models/instance/misc";

const InstanceShaderPacksPage = () => {
  const { t } = useTranslation();
  const {
    summary,
    handleOpenInstanceSubdir,
    handleImportResource,
    getShaderPackList,
  } = useInstanceSharedData();
  const { openSharedModal } = useSharedModals();

  const [shaderPacks, setShaderPacks] = useState<ShaderPackInfo[]>([]);

  useEffect(() => {
    setShaderPacks(getShaderPackList() || []);
  }, [getShaderPackList]);

  const shaderSecMenuOperations = [
    {
      icon: "openFolder",
      onClick: () => {
        handleOpenInstanceSubdir(InstanceSubdirEnums.ShaderPacks);
      },
    },
    {
      icon: "add",
      onClick: () => {
        handleImportResource({
          filterName: t("InstanceLayout.instanceTabList.shaderpacks"),
          filterExt: ["zip"],
          tgtDirType: InstanceSubdirEnums.ShaderPacks,
          decompress: false,
          onSuccessCallback: () => {
            setShaderPacks(getShaderPackList(true) || []);
          },
        });
      },
    },
    {
      icon: "download",
      onClick: () => {
        openSharedModal("download-resource", {
          initialResourceType: "shaderpack",
        });
      },
    },
    {
      icon: "refresh",
      onClick: () => {
        setShaderPacks(getShaderPackList(true) || []);
      },
    },
  ];

  const shaderItemMenuOperations = (pack: ShaderPackInfo) => [
    {
      label: "",
      icon: "copyOrMove",
      onClick: () => {
        openSharedModal("copy-or-move", {
          srcResName: pack.fileName,
          srcFilePath: pack.filePath,
        });
      },
    },
    {
      label: "",
      icon: "revealFile",
      onClick: () => revealItemInDir(pack.filePath),
    },
  ];

  return (
    <Section
      title={t("InstanceShaderPacksPage.shaderPackList.title")}
      titleExtra={<CountTag count={shaderPacks.length} />}
      headExtra={
        <HStack spacing={2}>
          {shaderSecMenuOperations.map((btn, index) => (
            <CommonIconButton
              key={index}
              icon={btn.icon}
              onClick={btn.onClick}
              size="xs"
              fontSize="sm"
              h={21}
            />
          ))}
        </HStack>
      }
    >
      {shaderPacks.length > 0 ? (
        <OptionItemGroup
          items={shaderPacks.map((pack) => (
            <OptionItem key={pack.fileName} title={pack.fileName}>
              <HStack spacing={0}>
                {shaderItemMenuOperations(pack).map((item, index) => (
                  <CommonIconButton
                    key={index}
                    icon={item.icon}
                    label={item.label}
                    onClick={item.onClick}
                    h={18}
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
  );
};

export default InstanceShaderPacksPage;

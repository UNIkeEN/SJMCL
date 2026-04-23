import { Center, HStack } from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BeatLoader } from "react-spinners";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useInstanceSharedData } from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { InstanceSubdirType } from "@/enums/instance";
import { GetStateFlag } from "@/hooks/get-state";
import { SchematicInfo } from "@/models/instance/misc";

const InstanceSchematicsPage = () => {
  const { t } = useTranslation();
  const {
    openInstanceSubdir,
    handleImportResource,
    getSchematicList,
    isSchematicListLoading: isLoading,
  } = useInstanceSharedData();
  const { openSharedModal } = useSharedModals();

  const [schematics, setSchematics] = useState<SchematicInfo[]>([]);

  const getSchematicListWrapper = useCallback(
    (sync?: boolean) => {
      getSchematicList(sync)
        .then((data) => {
          if (data === GetStateFlag.Cancelled) return;
          setSchematics(data || []);
        })
        .catch((e) => setSchematics([]));
    },
    [getSchematicList]
  );

  useEffect(() => {
    getSchematicListWrapper();
  }, [getSchematicListWrapper]);

  const schemSecMenuOperations = [
    {
      icon: "openFolder",
      onClick: () => {
        openInstanceSubdir(InstanceSubdirType.Schematics);
      },
    },
    {
      icon: "add",
      onClick: () => {
        handleImportResource({
          filterName: t("InstanceDetailsLayout.instanceTabList.schematics"),
          filterExt: ["schematic", "litematic"],
          tgtDirType: InstanceSubdirType.Schematics,
          decompress: false,
          onSuccessCallback: () => getSchematicListWrapper(true),
        });
      },
    },
    {
      icon: "refresh",
      onClick: () => getSchematicListWrapper(true),
    },
  ];

  const schemItemMenuOperations = (schematic: SchematicInfo) => [
    {
      label: "",
      icon: "copyOrMove",
      onClick: () => {
        openSharedModal("copy-or-move", {
          srcResName: schematic.name,
          srcFilePath: schematic.filePath,
        });
      },
    },
    {
      label: "",
      icon: "revealFile",
      onClick: () => revealItemInDir(schematic.filePath),
    },
  ];

  return (
    <>
      <Section
        title={t("InstanceSchematicsPage.schematicList.title")}
        titleExtra={<CountTag count={schematics.length} />}
        headExtra={
          <HStack spacing={2}>
            {schemSecMenuOperations.map((btn, index) => (
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
        {isLoading ? (
          <Center mt={4}>
            <BeatLoader size={16} color="gray" />
          </Center>
        ) : schematics.length > 0 ? (
          <OptionItemGroup
            items={schematics.map((schem) => (
              <OptionItem key={schem.name} title={schem.name}>
                <HStack spacing={0}>
                  {schemItemMenuOperations(schem).map((item, index) => (
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
    </>
  );
};

export default InstanceSchematicsPage;

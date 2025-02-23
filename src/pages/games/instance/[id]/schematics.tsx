import { HStack } from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEye } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useInstanceSharedData } from "@/contexts/instance";
import { InstanceSubdirEnums } from "@/enums/instance";
import { SchematicInfo } from "@/models/instance";
import { mockSchematics } from "@/models/mock/instance";

const InstanceSchematicsPage = () => {
  const { t } = useTranslation();
  const { openSubdir, getSchematicList } = useInstanceSharedData();

  const [schematics, setSchematics] = useState<SchematicInfo[]>([]);

  useEffect(() => {
    setSchematics(getSchematicList() || []);
  }, [getSchematicList]);

  const schemSecMenuOperations = [
    {
      icon: "openFolder",
      onClick: () => {
        openSubdir(InstanceSubdirEnums.Schematics);
      },
    },
    {
      icon: "refresh",
      onClick: () => {
        setSchematics(getSchematicList(true) || []);
      },
    },
  ];

  const schemItemMenuOperations = (schematic: SchematicInfo) => [
    {
      label: t("InstanceSchematicsPage.schematicList.preview"),
      icon: LuEye,
      onClick: () => {},
    },
    {
      label: "",
      icon: "copyOrMove",
      onClick: () => {},
    },
    {
      label: "",
      icon: "revealFile",
      onClick: () => revealItemInDir(schematic.filePath),
    },
  ];

  return (
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
      {schematics.length > 0 ? (
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
  );
};

export default InstanceSchematicsPage;

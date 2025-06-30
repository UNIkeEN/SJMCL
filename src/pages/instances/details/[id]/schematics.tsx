import { HStack, useDisclosure } from "@chakra-ui/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEye } from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import ViewSchematicModal from "@/components/modals/view-schematic-modal";
import { useInstanceSharedData } from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { InstanceSubdirType } from "@/enums/instance";
import { SchematicInfo } from "@/models/instance/misc";

const InstanceSchematicsPage = () => {
  const { t } = useTranslation();
  const { openInstanceSubdir, handleImportResource, getSchematicList } =
    useInstanceSharedData();
  const { openSharedModal } = useSharedModals();

  const [schematics, setSchematics] = useState<SchematicInfo[]>([]);
  const [selectedSchematic, setSelectedSchematic] =
    useState<SchematicInfo | null>(null);

  const {
    isOpen: isViewModalOpen,
    onOpen: onViewModalOpen,
    onClose: onViewModalClose,
  } = useDisclosure();

  useEffect(() => {
    setSchematics(getSchematicList() || []);
  }, [getSchematicList]);

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
          onSuccessCallback: () => {
            setSchematics(getSchematicList(true) || []);
          },
        });
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
      onClick: () => {
        setSelectedSchematic(schematic);
        onViewModalOpen();
      },
    },
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
      <ViewSchematicModal
        isOpen={isViewModalOpen}
        onClose={onViewModalClose}
        fileUrl={convertFileSrc(selectedSchematic?.filePath || "")}
      />
    </>
  );
};

export default InstanceSchematicsPage;

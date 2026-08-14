import {
  Button,
  Checkbox,
  CheckboxGroup,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Radio,
  RadioGroup,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { InstanceSummary, LocalModInfo } from "@/models/instance/misc";
import React, { useState } from "react";
import { ModLoaderType } from "@/enums/instance";
import { ResourceService } from "@/services/resource";
import { OtherResourceSource } from "@/enums/resource";
import { save } from "@tauri-apps/plugin-dialog";
import { UtilsService } from "@/services/utils";
import { Parser } from "json2csv";
import { useToast } from "@/contexts/toast";


interface ExportModListModalProps extends Omit<ModalProps, "children"> {
  summary: InstanceSummary | undefined;
  localMods: LocalModInfo[];
}

enum SupportedFormat {
  CSV = "CSV",
  JSON = "JSON"
}

class ExportedItem {
  constructor(
    public name: string,
    public translatedName: string,
    public description: string,
    public translatedDescription: string,
    public fileName: string,
    public version: string,
    public modloaderType: ModLoaderType,
    public enabled: boolean,
    public mcmodId: number,
    public mcmodWebsite: string,
    public modrinthWebsite: string,
    public curseforgeWebsite: string,
  ) {
  }
}

const ExportModListModal: React.FC<ExportModListModalProps> = ({
                                                                 summary,
                                                                 localMods,
                                                                 ...modalProps
                                                               }) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [selectedFormat, setSelectedFormat] = useState<string>(SupportedFormat.CSV.toString());
  const [selectedFields, setSelectedFields] = useState<(string | number)[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const toast = useToast();

  const formatKeys = Object.keys(SupportedFormat).filter(key => isNaN(Number(key)));
  const fieldKeys = Object.keys(new ExportedItem(
    "", "", "", "", "", "", ModLoaderType.Forge, false, 0, "", "", "",
  )).filter(key => key !== "constructor");

  const handleExport = async (): Promise<ExportedItem[]> => {
    let list: ExportedItem[] = [];

    for (const mod of localMods) {
      let item = new ExportedItem(
        mod.name,
        mod.translatedName || "",
        mod.description || "",
        mod.translatedDescription || "",
        mod.fileName,
        mod.version,
        mod.loaderType,
        mod.enabled,
        -1,
        "",
        "",
        "",
      );

      if ((selectedFields.includes("mcmodId") && item.mcmodId === -1) || selectedFields.includes("modrinthWebsite")) {
        try {
          const response = await ResourceService.fetchRemoteResourceByLocal(
            OtherResourceSource.Modrinth,
            mod.filePath,
          );
          if (response.status === "success") {
            const modId = response.data.resourceId;
            const res = await ResourceService.fetchRemoteResourceById(
              OtherResourceSource.Modrinth,
              modId,
            );
            if (res.status === "success") {
              if (res.data.websiteUrl) {
                item.modrinthWebsite = res.data.websiteUrl;
              }
              if (res.data.mcmodId) {
                item.mcmodId = res.data.mcmodId;
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch Modrinth data:", error);
        }

        if ((selectedFields.includes("mcmodId") && item.mcmodId === -1) || selectedFields.includes("curseforgeWebsite")) {
          try {
            const response = await ResourceService.fetchRemoteResourceByLocal(
              OtherResourceSource.CurseForge,
              mod.filePath,
            );
            if (response.status === "success") {
              const modId = response.data.resourceId;
              const res = await ResourceService.fetchRemoteResourceById(
                OtherResourceSource.CurseForge,
                modId,
              );
              if (res.status === "success") {
                if (res.data.websiteUrl) {
                  item.curseforgeWebsite = res.data.websiteUrl;
                }
                if (res.data.mcmodId) {
                  item.mcmodId = res.data.mcmodId;
                }
              }
            }
          } catch (error) {
            console.error("Failed to fetch CurseForge data:", error);
          }
        }


        if (item.mcmodId !== -1) {
          item.mcmodWebsite = `https://www.mcmod.cn/class/${item.mcmodId}.html`;
        }
      }

      list.push(item);
    }

    return list;
  };

  const handleExportClick = async () => {
    setIsLoading(true);
    try {
      const exportedData = await handleExport();

      const filteredData = exportedData.map(item => {
        const filteredItem: any = {};
        selectedFields.forEach(field => {
          if (field in item) {
            filteredItem[field] = (item as any)[field];
          }
        });
        return filteredItem;
      });

      const filePath = await save({
        defaultPath: "mod-list." + selectedFormat.toLowerCase(),
        filters: [{
          name: selectedFormat.toLowerCase(),
          extensions: [selectedFormat.toLowerCase()],
        }],
      });

      if (filePath != null) {
        let content: string;

        if (selectedFormat === SupportedFormat.JSON) {
          content = JSON.stringify(filteredData, null, 2);
        } else {
          content = new Parser().parse(filteredData);
        }
        await UtilsService.writeFile(filePath, content, "string");

        toast({
          title: t("ExportModListModal.toast.success"),
          status: "success",
        });
      }
    } catch (error) {
      await logger.error(`Failed to handle export:`, error);
      toast({
        title: t("ExportModListModal.toast.failed"),
        status: "error",
      });
      return null;
    } finally {
      setIsLoading(false);
      modalProps.onClose?.();
    }
  };

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      returnFocusOnClose={false}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
        <ModalHeader>
          <HStack w="100%" justify="flex-start" align="center">
            <Text>{t("ExportModListModal.header.title")}</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody
          flex="1"
          display="flex"
          flexDirection="column"
          overflow="hidden"
        >
          <VStack spacing={4} align="stretch" w="100%">
            <Text>{t("ExportModListModal.format")}</Text>

            <RadioGroup
              value={selectedFormat}
              onChange={setSelectedFormat}
            >
              <HStack spacing={5}>
                {formatKeys.map((format) => (
                  <HStack key={format}>
                    <Radio value={format}>
                      <Text>{format}</Text>
                    </Radio>
                  </HStack>
                ))}
              </HStack>
            </RadioGroup>

            <Text mt={4}>{t("ExportModListModal.field.field")}</Text>

            <CheckboxGroup
              value={selectedFields}
              onChange={setSelectedFields}
            >
              <Wrap spacing={5}>
                {fieldKeys.map((field) => (
                  <WrapItem key={field}>
                    <Checkbox value={field}>
                      <Text>{t(`ExportModListModal.field.${field}`)}</Text>
                    </Checkbox>
                  </WrapItem>
                ))}
              </Wrap>
            </CheckboxGroup>

          </VStack>
        </ModalBody>

        <ModalFooter flexShrink={0}>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={modalProps.onClose}>
              {t("ExportModListModal.button.cancel")}
            </Button>
            <Button
              isLoading={isLoading}
              colorScheme={primaryColor}
              onClick={handleExportClick}
              isDisabled={localMods.length === 0 || selectedFields.length === 0}
            >
              {t("ExportModListModal.button.export")}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ExportModListModal;

import {
  Button,
  Checkbox,
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
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { save } from "@tauri-apps/plugin-dialog";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import Editable from "@/components/common/editable";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { InstanceService } from "@/services/instance";
import { isFileNameSanitized, sanitizeFileName } from "@/utils/string";

interface ExportModpackModalProps extends Omit<ModalProps, "children"> {
  instanceId: string;
  instanceName: string;
}

interface ExportModpackOptions {
  format: "Modrinth" | "MCBBS" | "MultiMC";
  name: string;
  version: string;
  author?: string;
  description?: string;
  includeConfig: boolean;
  includeMods: boolean;
  includeResourcepacks: boolean;
  includeShaderpacks: boolean;
  includeSaves: boolean;
}

const ExportModpackModal: React.FC<ExportModpackModalProps> = ({
  instanceId,
  instanceName,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const toast = useToast();
  const primaryColor = config.appearance.theme.primaryColor;

  const [exportFormat, setExportFormat] = useState<
    "Modrinth" | "MCBBS" | "MultiMC"
  >("Modrinth");
  const [modpackName, setModpackName] = useState(instanceName);
  const [modpackVersion, setModpackVersion] = useState("1.0.0");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [includeConfig, setIncludeConfig] = useState(true);
  const [includeMods, setIncludeMods] = useState(true);
  const [includeResourcepacks, setIncludeResourcepacks] = useState(true);
  const [includeShaderpacks, setIncludeShaderpacks] = useState(true);
  const [includeSaves, setIncludeSaves] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkNameError = useCallback((value: string): number => {
    if (value.trim() === "") return 1;
    if (!isFileNameSanitized(value)) return 2;
    if (value.length > 255) return 3;
    return 0;
  }, []);

  const checkVersionError = useCallback((value: string): number => {
    if (value.trim() === "") return 1;
    return 0;
  }, []);

  const handleExport = useCallback(async () => {
    // Validate inputs
    if (checkNameError(modpackName) !== 0) {
      toast({
        title: t("ExportModpackModal.error.invalidName"),
        status: "warning",
      });
      return;
    }

    if (checkVersionError(modpackVersion) !== 0) {
      toast({
        title: t("ExportModpackModal.error.invalidVersion"),
        status: "warning",
      });
      return;
    }

    // Check at least one category is selected
    if (
      !includeConfig &&
      !includeMods &&
      !includeResourcepacks &&
      !includeShaderpacks &&
      !includeSaves
    ) {
      toast({
        title: t("ExportModpackModal.error.noCategorySelected"),
        status: "warning",
      });
      return;
    }

    // Open save dialog
    const fileExtension = exportFormat === "Modrinth" ? "mrpack" : "zip";
    const savePath = await save({
      defaultPath: `${sanitizeFileName(modpackName)}-${modpackVersion}.${fileExtension}`,
      filters: [
        {
          name: t("General.dialog.filterName.modpack"),
          extensions: [fileExtension],
        },
      ],
    });

    if (!savePath) {
      return; // User cancelled
    }

    setIsLoading(true);

    try {
      const options: ExportModpackOptions = {
        format: exportFormat,
        name: modpackName,
        version: modpackVersion,
        author: author || undefined,
        description: description || undefined,
        includeConfig,
        includeMods,
        includeResourcepacks,
        includeShaderpacks,
        includeSaves,
      };

      const response = await InstanceService.exportModpack(
        instanceId,
        savePath,
        options
      );

      if (response.status === "success") {
        toast({
          title: t("ExportModpackModal.success.title"),
          description: t("ExportModpackModal.success.description"),
          status: "success",
        });
        modalProps.onClose?.();
      } else {
        toast({
          title: t("ExportModpackModal.error.title"),
          description: response.details || response.message,
          status: "error",
        });
      }
    } catch (error) {
      toast({
        title: t("ExportModpackModal.error.title"),
        description: String(error),
        status: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    instanceId,
    exportFormat,
    modpackName,
    modpackVersion,
    author,
    description,
    includeConfig,
    includeMods,
    includeResourcepacks,
    includeShaderpacks,
    includeSaves,
    checkNameError,
    checkVersionError,
    toast,
    t,
    modalProps,
  ]);

  const optionGroups: OptionItemGroupProps[] = [
    {
      title: t("ExportModpackModal.label.exportFormat"),
      items: [
        {
          title: "",
          children: (
            <RadioGroup
              value={exportFormat}
              onChange={(val) =>
                setExportFormat(val as "Modrinth" | "MCBBS" | "MultiMC")
              }
              w="100%"
            >
              <Stack direction="column" spacing={2} align="start" w="100%">
                <Radio value="Modrinth" colorScheme={primaryColor}>
                  <Text fontSize="xs-sm">Modrinth</Text>
                </Radio>
                <Radio value="MCBBS" colorScheme={primaryColor}>
                  <Text fontSize="xs-sm">MCBBS</Text>
                </Radio>
                <Radio value="MultiMC" colorScheme={primaryColor}>
                  <Text fontSize="xs-sm">MultiMC</Text>
                </Radio>
              </Stack>
            </RadioGroup>
          ),
        },
      ],
    },
    {
      title: t("ExportModpackModal.label.basicInfo"),
      items: [
        {
          title: t("ExportModpackModal.label.modpackName"),
          children: (
            <Editable
              isTextArea={false}
              value={modpackName}
              onEditSubmit={setModpackName}
              textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
              inputProps={{ fontSize: "xs-sm" }}
              formErrMsgProps={{ fontSize: "xs-sm" }}
              checkError={checkNameError}
              localeKey="ExportModpackModal.errorMessage"
            />
          ),
        },
        {
          title: t("ExportModpackModal.label.modpackVersion"),
          children: (
            <Editable
              isTextArea={false}
              value={modpackVersion}
              onEditSubmit={setModpackVersion}
              textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
              inputProps={{ fontSize: "xs-sm" }}
              formErrMsgProps={{ fontSize: "xs-sm" }}
              checkError={checkVersionError}
              localeKey="ExportModpackModal.errorMessage"
            />
          ),
        },
        {
          title: t("ExportModpackModal.label.author"),
          children: (
            <Editable
              isTextArea={false}
              value={author}
              onEditSubmit={setAuthor}
              textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
              inputProps={{
                fontSize: "xs-sm",
                placeholder: t("General.optional"),
              }}
            />
          ),
        },
        {
          title: t("ExportModpackModal.label.description"),
          children: (
            <Editable
              isTextArea={true}
              value={description}
              onEditSubmit={setDescription}
              textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
              inputProps={{
                fontSize: "xs-sm",
                placeholder: t("General.optional"),
              }}
            />
          ),
        },
      ],
    },
    {
      title: t("ExportModpackModal.label.includedFiles"),
      items: [
        {
          title: "",
          children: (
            <VStack align="start" spacing={2} w="100%">
              <Checkbox
                isChecked={includeMods}
                onChange={(e) => setIncludeMods(e.target.checked)}
                isDisabled={true}
              >
                <Text fontSize="sm">
                  {t("ExportModpackModal.label.includeMods")}
                </Text>
              </Checkbox>
              <Checkbox
                isChecked={includeConfig}
                onChange={(e) => setIncludeConfig(e.target.checked)}
              >
                <Text fontSize="sm">
                  {t("ExportModpackModal.label.includeConfig")}
                </Text>
              </Checkbox>
              <Checkbox
                isChecked={includeResourcepacks}
                onChange={(e) => setIncludeResourcepacks(e.target.checked)}
              >
                <Text fontSize="sm">
                  {t("ExportModpackModal.label.includeResourcePacks")}
                </Text>
              </Checkbox>
              <Checkbox
                isChecked={includeShaderpacks}
                onChange={(e) => setIncludeShaderpacks(e.target.checked)}
              >
                <Text fontSize="sm">
                  {t("ExportModpackModal.label.includeShaderPacks")}
                </Text>
              </Checkbox>
              <Checkbox
                isChecked={includeSaves}
                onChange={(e) => setIncludeSaves(e.target.checked)}
              >
                <Text fontSize="sm">
                  {t("ExportModpackModal.label.includeSaves")}
                </Text>
              </Checkbox>
            </VStack>
          ),
        },
      ],
    },
  ];

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="80vh">
        <ModalHeader>{t("ExportModpackModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {optionGroups.map((group, index) => (
            <OptionItemGroup {...group} key={index} />
          ))}
        </ModalBody>
        <ModalFooter>
          <HStack spacing={2}>
            <Button variant="ghost" onClick={modalProps.onClose}>
              {t("General.cancel")}
            </Button>
            <Button
              colorScheme={primaryColor}
              onClick={handleExport}
              isLoading={isLoading}
            >
              {t("ExportModpackModal.button.export")}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ExportModpackModal;

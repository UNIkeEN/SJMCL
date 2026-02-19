import {
  Box,
  Button,
  Center,
  Checkbox,
  HStack,
  IconButton,
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
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { save } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuChevronRight } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import Editable from "@/components/common/editable";
import Empty from "@/components/common/empty";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { ModpackFileList } from "@/models/instance/misc";
import { InstanceService } from "@/services/instance";
import { isFileNameSanitized, sanitizeFileName } from "@/utils/string";

interface ExportModpackModalProps extends Omit<ModalProps, "children"> {
  instanceId: string;
  instanceName: string;
}

interface ExportModpackOptions {
  format: "Modrinth" | "MultiMC";
  name: string;
  version: string;
  author?: string;
  description?: string;
  packWithLauncher?: boolean;
  minMemory?: number;
  noCreateRemoteFiles?: boolean;
  skipCurseForgeRemoteFiles?: boolean;
}

interface FileTreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: FileTreeNode[];
}

const buildFileTree = (paths: string[]): FileTreeNode[] => {
  type InternalNode = {
    name: string;
    path: string;
    isFile: boolean;
    children: Map<string, InternalNode>;
  };

  const root = new Map<string, InternalNode>();
  for (const rawPath of paths) {
    const parts = rawPath.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";
    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = current.get(part);
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          isFile: false,
          children: new Map<string, InternalNode>(),
        };
        current.set(part, node);
      }
      if (index === parts.length - 1) {
        node.isFile = true;
      }
      current = node.children;
    });
  }

  const convert = (map: Map<string, InternalNode>): FileTreeNode[] =>
    Array.from(map.values())
      .sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        name: node.name,
        path: node.path,
        isFile: node.isFile,
        children: convert(node.children),
      }));

  return convert(root);
};

const collectLeafPaths = (node: FileTreeNode): string[] => {
  if (node.isFile || node.children.length === 0) {
    return [node.path];
  }
  return node.children.flatMap((child) => collectLeafPaths(child));
};

const ExportModpackModal: React.FC<ExportModpackModalProps> = ({
  instanceId,
  instanceName,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const toast = useToast();
  const primaryColor = config.appearance.theme.primaryColor;

  const [exportFormat, setExportFormat] = useState<"Modrinth" | "MultiMC">(
    "Modrinth"
  );
  const [modpackName, setModpackName] = useState(instanceName);
  const [modpackVersion, setModpackVersion] = useState("1.0.0");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fileList, setFileList] = useState<ModpackFileList | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isFileListLoading, setIsFileListLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [packWithLauncher, setPackWithLauncher] = useState(false);
  const [minMemoryInput, setMinMemoryInput] = useState("");
  const [noCreateRemoteFiles, setNoCreateRemoteFiles] = useState(false);
  const [skipCurseForgeRemoteFiles, setSkipCurseForgeRemoteFiles] =
    useState(false);

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

  useEffect(() => {
    if (!modalProps.isOpen) return;
    let isActive = true;
    setIsFileListLoading(true);

    InstanceService.listModpackFiles(instanceId)
      .then((response) => {
        if (!isActive) return;
        if (response.status === "success") {
          setFileList(response.data);
          const nextSelected = new Set(response.data.all);
          response.data.unchecked.forEach((path) => nextSelected.delete(path));
          setSelectedFiles(nextSelected);
        } else {
          toast({
            title: t("ExportModpackModal.error.title"),
            description: response.details || response.message,
            status: "error",
          });
        }
      })
      .catch((error) => {
        if (!isActive) return;
        toast({
          title: t("ExportModpackModal.error.title"),
          description: String(error),
          status: "error",
        });
      })
      .finally(() => {
        if (!isActive) return;
        setIsFileListLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [instanceId, modalProps.isOpen, t, toast]);

  const fileTree = useMemo(
    () => (fileList ? buildFileTree(fileList.all) : []),
    [fileList]
  );

  const selectedFileList = useMemo(() => {
    if (!fileList) return [];
    return fileList.all.filter((path) => selectedFiles.has(path));
  }, [fileList, selectedFiles]);

  const isMultiMC = exportFormat === "MultiMC";
  const isModrinth = exportFormat === "Modrinth";

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
      const parsedMinMemory = minMemoryInput.trim()
        ? Number.parseInt(minMemoryInput.trim(), 10)
        : undefined;

      const options: ExportModpackOptions = {
        format: exportFormat,
        name: modpackName,
        version: modpackVersion,
        author: author || undefined,
        description: description || undefined,
        packWithLauncher: packWithLauncher || undefined,
        minMemory: Number.isNaN(parsedMinMemory || NaN)
          ? undefined
          : parsedMinMemory,
        noCreateRemoteFiles: noCreateRemoteFiles || undefined,
        skipCurseForgeRemoteFiles: skipCurseForgeRemoteFiles || undefined,
      };

      const response = await InstanceService.exportModpack(
        instanceId,
        savePath,
        options,
        selectedFileList
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
    checkNameError,
    modpackName,
    checkVersionError,
    modpackVersion,
    exportFormat,
    t,
    toast,
    minMemoryInput,
    author,
    description,
    packWithLauncher,
    noCreateRemoteFiles,
    skipCurseForgeRemoteFiles,
    instanceId,
    selectedFileList,
    modalProps,
  ]);

  const FileTreeItem: React.FC<{ node: FileTreeNode; depth?: number }> = ({
    node,
    depth = 0,
  }) => {
    const expanded = expandedPaths.has(node.path);
    const leafPaths = useMemo(() => collectLeafPaths(node), [node]);
    const selectedCount = useMemo(
      () => leafPaths.filter((path) => selectedFiles.has(path)).length,
      [leafPaths]
    );
    const isChecked =
      leafPaths.length > 0 && selectedCount === leafPaths.length;
    const isIndeterminate =
      selectedCount > 0 && selectedCount < leafPaths.length;

    const handleToggle = (checked: boolean) => {
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        leafPaths.forEach((path) => {
          if (checked) {
            next.add(path);
          } else {
            next.delete(path);
          }
        });
        return next;
      });
    };

    return (
      <VStack align="start" spacing={1} w="100%" pl={depth * 3}>
        <HStack spacing={1} w="100%" align="center" minH={6}>
          {!node.isFile ? (
            <IconButton
              aria-label={expanded ? "collapse" : "expand"}
              icon={expanded ? <LuChevronDown /> : <LuChevronRight />}
              size="xs"
              variant="ghost"
              onClick={() =>
                setExpandedPaths((prev) => {
                  const next = new Set(prev);
                  if (expanded) {
                    next.delete(node.path);
                  } else {
                    next.add(node.path);
                  }
                  return next;
                })
              }
            />
          ) : (
            <Box w="24px" />
          )}
          <Checkbox
            isChecked={isChecked}
            isIndeterminate={isIndeterminate}
            onChange={(e) => handleToggle(e.target.checked)}
            colorScheme={primaryColor}
            size="sm"
          >
            <Text fontSize="xs-sm" className="ellipsis-text">
              {node.name}
            </Text>
          </Checkbox>
        </HStack>
        {!node.isFile && expanded && (
          <VStack align="start" spacing={1} w="100%">
            {node.children.map((child) => (
              <FileTreeItem key={child.path} node={child} depth={depth + 1} />
            ))}
          </VStack>
        )}
      </VStack>
    );
  };

  const optionGroups: OptionItemGroupProps[] = [
    {
      title: t("ExportModpackModal.label.exportFormat"),
      items: [
        {
          title: "",
          children: (
            <RadioGroup
              value={exportFormat}
              onChange={(val) => setExportFormat(val as "Modrinth" | "MultiMC")}
              w="100%"
            >
              <Stack direction="column" spacing={2} align="start" w="100%">
                <Radio value="Modrinth" colorScheme={primaryColor}>
                  <Text fontSize="xs-sm">Modrinth</Text>
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
            <Box w="100%" maxH="260px" overflowY="auto">
              {isFileListLoading ? (
                <Center py={4}>
                  <BeatLoader size={10} color="gray" />
                </Center>
              ) : fileTree.length > 0 ? (
                <VStack align="start" spacing={1} w="100%">
                  {fileTree.map((node) => (
                    <FileTreeItem key={node.path} node={node} />
                  ))}
                </VStack>
              ) : (
                <Empty withIcon={false} size="sm" />
              )}
            </Box>
          ),
        },
      ],
    },
    {
      title: t("ExportModpackModal.label.exportOptions"),
      items: [
        {
          title: t("ExportModpackModal.label.packWithLauncher"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={packWithLauncher}
              onChange={(e) => setPackWithLauncher(e.target.checked)}
            />
          ),
        },
        ...(isMultiMC
          ? [
              {
                title: t("ExportModpackModal.label.minMemory"),
                children: (
                  <Editable
                    isTextArea={false}
                    value={minMemoryInput}
                    onEditSubmit={setMinMemoryInput}
                    textProps={{
                      className: "secondary-text",
                      fontSize: "xs-sm",
                    }}
                    inputProps={{
                      fontSize: "xs-sm",
                      placeholder: t("General.optional"),
                    }}
                  />
                ),
              },
            ]
          : []),
        ...(isModrinth
          ? [
              {
                title: t("ExportModpackModal.label.noCreateRemoteFiles"),
                children: (
                  <Switch
                    colorScheme={primaryColor}
                    isChecked={noCreateRemoteFiles}
                    onChange={(e) => setNoCreateRemoteFiles(e.target.checked)}
                  />
                ),
              },
              {
                title: t("ExportModpackModal.label.skipCurseForgeRemoteFiles"),
                children: (
                  <Switch
                    colorScheme={primaryColor}
                    isChecked={skipCurseForgeRemoteFiles}
                    onChange={(e) =>
                      setSkipCurseForgeRemoteFiles(e.target.checked)
                    }
                  />
                ),
              },
            ]
          : []),
      ].filter(Boolean) as OptionItemGroupProps["items"],
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

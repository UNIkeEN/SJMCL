import {
  Button,
  Center,
  HStack,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Radio,
  VStack,
} from "@chakra-ui/react";
import { t } from "i18next";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BeatLoader } from "react-spinners";
import Editable from "@/components/common/editable";
import {
  OptionItemGroup,
  OptionItemGroupProps,
  OptionItemProps,
} from "@/components/common/option-item";
import { InstanceIconSelectorPopover } from "@/components/instance-icon-selector";
import {
  gameTypesToIcon,
  loaderTypesToIcon,
} from "@/components/modals/create-instance-modal";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { ModpackMetaInfo } from "@/models/instance/misc";
import {
  ModLoaderResourceInfo,
  defaultModLoaderResourceInfo,
} from "@/models/resource";
import { InstanceService } from "@/services/instance";
import { ResourceService } from "@/services/resource";
import { getGameDirName } from "@/utils/instance";
import { isFileNameSanitized, sanitizeFileName } from "@/utils/string";

interface ImportModpackModalProps extends Omit<ModalProps, "children"> {
  path: string;
}

const ImportModpackModal: React.FC<ImportModpackModalProps> = ({
  path,
  ...modalProps
}) => {
  const { config } = useLauncherConfig();
  const router = useRouter();
  const toast = useToast();
  const primaryColor = config.appearance.theme.primaryColor;
  const { onClose } = modalProps;

  const [modpack, setModpack] = useState<ModpackMetaInfo>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconSrc, setIconSrc] = useState("");
  const [gameDirectory, setGameDirectory] = useState(
    config.localGameDirectories[0]
  );
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isBtnLoading, setIsBtnLoading] = useState(false);

  const checkDirNameError = useCallback((value: string): number => {
    if (value.trim() === "") return 1;
    if (!isFileNameSanitized(value)) return 2;
    if (value.length > 255) return 3;
    return 0;
  }, []);

  const modpackInfoGroup: OptionItemGroupProps[] = useMemo(() => {
    if (!modpack) return [];
    return [
      {
        title: t("ImportModpackModal.label.instanceSettings"),
        items: [
          {
            title: t("InstanceSettingsPage.name"),
            children: (
              <Editable
                isTextArea={false}
                value={name}
                onEditSubmit={setName}
                textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
                inputProps={{ fontSize: "xs-sm" }}
                formErrMsgProps={{ fontSize: "xs-sm" }}
                checkError={checkDirNameError}
                localeKey="InstanceSettingsPage.errorMessage"
              />
            ),
          },
          {
            title: t("InstanceSettingsPage.description"),
            children: (
              <Editable
                isTextArea={true}
                value={description}
                onEditSubmit={setDescription}
                textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
                inputProps={{ fontSize: "xs-sm" }}
              />
            ),
          },
          {
            title: t("InstanceSettingsPage.icon"),
            children: (
              <HStack>
                <Image
                  src={iconSrc}
                  alt={iconSrc}
                  boxSize="28px"
                  objectFit="cover"
                />
                <InstanceIconSelectorPopover
                  value={iconSrc}
                  onIconSelect={setIconSrc}
                />
              </HStack>
            ),
          },
        ],
      },
      {
        title: t("InstanceBasicSettings.selectDirectory"),
        items: config.localGameDirectories.map(
          (directory): OptionItemProps => ({
            title: getGameDirName(directory),
            description: directory.dir,
            prefixElement: (
              <Radio
                isChecked={directory.dir === gameDirectory?.dir}
                onChange={() => {
                  setGameDirectory(directory);
                }}
              />
            ),
            children: <></>,
          })
        ),
      },
      {
        title: t("ImportModpackModal.label.modpackInfo"),
        items: [
          {
            title: t("ImportModpackModal.label.modpackName"),
            children: modpack.name,
          },
          {
            title: t("ImportModpackModal.label.modpackVersion"),
            children: modpack.version,
          },
          {
            title: t("ImportModpackModal.label.author"),
            children: modpack.author || "-",
          },
          {
            title: t("ImportModpackModal.label.modLoader"),
            children: modpack.modLoader
              ? `${modpack.modLoader.loaderType} ${modpack.modLoader.version} ${
                  modpack.modLoader.branch
                    ? `(${modpack.modLoader.branch})`
                    : ""
                }`
              : "-",
          },
          {
            title: t("ImportModpackModal.label.gameVersion"),
            children: modpack.clientVersion,
          },
        ],
      },
    ];
  }, [
    modpack,
    name,
    description,
    iconSrc,
    gameDirectory,
    config.localGameDirectories,
    checkDirNameError,
    setDescription,
    setGameDirectory,
  ]);

  const handleImportModpack = useCallback(async () => {
    if (!modpack || checkDirNameError(name) !== 0 || !gameDirectory) return;
    try {
      setIsBtnLoading(true);
      // first get client resource info
      const versionResp = await ResourceService.fetchGameVersionSpecific(
        modpack.clientVersion
      );
      if (versionResp.status !== "success") {
        toast({
          title: versionResp.message,
          description: versionResp.details,
          status: "error",
        });
        return;
      }
      const clientResourceInfo = versionResp.data;

      // then install modpack through `create_instance`
      const createResp = await InstanceService.createInstance(
        gameDirectory,
        name,
        description,
        iconSrc,
        clientResourceInfo,
        modpack.modLoader
          ? ({
              loaderType: modpack.modLoader.loaderType,
              version: modpack.modLoader.version,
              branch: modpack.modLoader.branch,
              description: "",
              stable: true,
            } as ModLoaderResourceInfo)
          : defaultModLoaderResourceInfo,
        undefined,
        path
      );
      if (createResp.status === "success") {
        onClose();
        router.push("/downloads");
      } else {
        toast({
          title: createResp.message,
          description: createResp.details,
          status: "error",
        });
      }
    } catch (error) {
      logger.error("Error creating instance:", error);
    } finally {
      setIsBtnLoading(false);
    }
  }, [
    checkDirNameError,
    description,
    gameDirectory,
    iconSrc,
    onClose,
    modpack,
    name,
    path,
    router,
    toast,
  ]);

  useEffect(() => {
    setIsPageLoading(true);
    InstanceService.retrieveModpackMetaInfo(path)
      .then((response) => {
        if (response.status === "success") {
          setModpack(response.data);
          setName(sanitizeFileName(response.data.name));
          setDescription(response.data.description || "");
          setIconSrc(
            response.data.modLoader
              ? loaderTypesToIcon[response.data.modLoader.loaderType]
              : gameTypesToIcon["release"]
          );
        } else {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
          onClose();
        }
      })
      .catch((error) => {
        logger.error("Error fetching modpack info:", error);
      })
      .finally(() => {
        setIsPageLoading(false);
      });
  }, [path, toast, onClose]);

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      autoFocus={false}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
        <ModalHeader>{t("ImportModpackModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody h="100%">
          {isPageLoading ? (
            <Center h="100%">
              <BeatLoader size={16} color="gray" />
            </Center>
          ) : (
            <VStack w="100%" spacing={4}>
              {modpackInfoGroup.map((group, index) => (
                <OptionItemGroup
                  title={group.title}
                  items={group.items}
                  key={index}
                  w="100%"
                />
              ))}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            colorScheme={primaryColor}
            onClick={() => handleImportModpack()}
            isLoading={isBtnLoading || isPageLoading}
          >
            {t("General.import")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ImportModpackModal;

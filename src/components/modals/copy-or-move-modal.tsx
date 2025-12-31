import {
  Button,
  Checkbox,
  Flex,
  HStack,
  Icon,
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
  RadioGroup,
  Tag,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { LuCopy, LuScissors } from "react-icons/lu";
import { OptionItemGroup } from "@/components/common/option-item";
import SegmentedControl from "@/components/common/segmented";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useToast } from "@/contexts/toast";
import { InstanceSubdirType } from "@/enums/instance";
import { InstanceError } from "@/enums/service-error";
import { InstanceSummary } from "@/models/instance/misc";
import { InstanceService } from "@/services/instance";
import { generateInstanceDesc, getInstanceIconSrc } from "@/utils/instance";

interface CopyOrMoveModalProps extends Omit<ModalProps, "children"> {
  srcResName: string;
  srcFilePath: string;
  tgtDirType?: InstanceSubdirType;
  srcInstanceId?: string;
}

const CopyOrMoveModal: React.FC<CopyOrMoveModalProps> = ({
  srcResName,
  srcFilePath,
  tgtDirType = InstanceSubdirType.Root,
  srcInstanceId,
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { getInstanceList } = useGlobalData();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const router = useRouter();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [operation, setOperation] = useState<"copy" | "move">("copy");
  const [instanceList, setInstanceList] = useState<InstanceSummary[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<InstanceSummary[]>(
    []
  );
  const [_tgtDirType, _setTgtDirType] =
    useState<InstanceSubdirType>(tgtDirType);
  const [_srcInstanceId, _setSrcInstanceId] = useState<string | undefined>(
    srcInstanceId
  );

  useEffect(() => {
    if (srcInstanceId !== undefined) return;
    if (router === undefined) {
      toast({
        title: t("CopyOrMoveModal.error.lackOfArguments"),
        status: "error",
      });
      return;
    }
    const { id } = router.query;
    const instanceId = Array.isArray(id) ? id[0] : id;
    _setSrcInstanceId(instanceId);
  }, [router, srcInstanceId, t, toast]);

  useEffect(() => {
    if (tgtDirType !== InstanceSubdirType.Root) return;
    if (router === undefined) {
      toast({
        title: t("CopyOrMoveModal.error.lackOfArguments"),
        status: "error",
      });
      return;
    }
    switch (router.pathname.split("/").pop()) {
      case "resourcepacks":
        _setTgtDirType(InstanceSubdirType.ResourcePacks);
        break;
      case "shaderpacks":
        _setTgtDirType(InstanceSubdirType.ShaderPacks);
        break;
      case "schematics":
        _setTgtDirType(InstanceSubdirType.Schematics);
        break;
      case "worlds":
        _setTgtDirType(InstanceSubdirType.Saves);
        break;
    }
  }, [router, tgtDirType, t, toast]);

  const operationList = [
    {
      key: "copy",
      icon: LuCopy,
      label: t("CopyOrMoveModal.operation.copy"),
    },
    {
      key: "move",
      icon: LuScissors,
      label: t("CopyOrMoveModal.operation.move"),
    },
  ];

  const handleCopyResourceToInstances = useCallback(
    (
      srcFilePath: string,
      tgtInstId: string[],
      tgtDirType: InstanceSubdirType
    ) => {
      if (
        srcFilePath !== undefined &&
        tgtInstId &&
        tgtDirType !== InstanceSubdirType.Root
      ) {
        InstanceService.copyResourceToInstances(
          srcFilePath,
          tgtInstId,
          tgtDirType
        ).then((response) => {
          if (response.status !== "success") {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
            if (
              response.raw_error === InstanceError.InvalidSourcePath ||
              response.raw_error === InstanceError.InstanceNotFoundById
            ) {
              router.push(router.asPath); // meet error, refresh page to get new instance and file list.
            }
          } else
            toast({
              title: response.message,
              status: "success",
            });
        });
      }
    },
    [toast, router]
  );

  const handleMoveResourceToInstance = useCallback(
    (
      srcFilePath: string,
      tgtInstId: string,
      tgtDirType: InstanceSubdirType
    ) => {
      if (
        srcFilePath !== undefined &&
        tgtInstId &&
        tgtDirType !== InstanceSubdirType.Root
      ) {
        InstanceService.moveResourceToInstance(
          srcFilePath,
          tgtInstId,
          tgtDirType
        ).then((response) => {
          if (response.status !== "success")
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          else
            toast({
              title: response.message,
              status: "success",
            });
        });
      }
    },
    [toast]
  );

  const handleCopyOrMove = async () => {
    setIsLoading(true);
    if (operation === "copy") {
      handleCopyResourceToInstances(
        srcFilePath,
        selectedInstances.map((instance) => instance.id),
        _tgtDirType
      );
    } else {
      handleMoveResourceToInstance(
        srcFilePath,
        selectedInstances[0].id,
        _tgtDirType
      );
    }
    modalProps.onClose();
    setIsLoading(false);
  };

  const buildOptionItems = (instance: InstanceSummary) => ({
    title: instance.name,
    titleExtra: instance.id === _srcInstanceId && (
      <Tag colorScheme={primaryColor} className="tag-xs">
        {t("CopyOrMoveModal.tag.source")}
      </Tag>
    ),
    description: [generateInstanceDesc(instance), instance.description]
      .filter(Boolean)
      .join(", "),
    prefixElement: (
      <HStack spacing={2.5}>
        {operation === "move" ? (
          <Radio
            value={instance.id}
            colorScheme={primaryColor}
            isDisabled={instance.id === _srcInstanceId}
            onClick={() => {
              if (instance.id === _srcInstanceId) return;
              setSelectedInstances([instance]);
            }}
          />
        ) : (
          <Checkbox
            key={instance.id}
            isChecked={selectedInstances.some(
              (selected) => selected.id === instance.id
            )}
            colorScheme={primaryColor}
            isDisabled={instance.id === _srcInstanceId}
            borderColor="gray.400"
            onChange={() => {
              if (instance.id === _srcInstanceId) return;
              setSelectedInstances((prevSelected) => {
                if (prevSelected.includes(instance)) {
                  return prevSelected.filter(
                    (selected) => selected.id !== instance.id
                  );
                }
                return [...prevSelected, instance];
              });
            }}
          />
        )}
        <Image
          src={getInstanceIconSrc(instance.iconSrc, instance.versionPath)}
          alt={instance.name}
          boxSize="32px"
          fallbackSrc="/images/icons/JEIcon_Release.png"
        />
      </HStack>
    ),
    children: <></>,
  });

  useEffect(() => {
    setInstanceList(getInstanceList() || []);
  }, [getInstanceList]);

  useEffect(() => {
    setSelectedInstances([]);
  }, [operation]);

  return (
    <Modal
      size={{ base: "md", lg: "lg", xl: "xl" }}
      scrollBehavior="inside"
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
        <ModalHeader>{t("CopyOrMoveModal.modal.header")}</ModalHeader>
        <ModalCloseButton />

        <Flex flexGrow="1" flexDir="column" h="100%" overflow="auto">
          <ModalBody>
            <Flex flexDirection="column" overflow="hidden" h="100%">
              <VStack>
                <Flex flexWrap="wrap" direction="row" align="center">
                  <SegmentedControl
                    selected={operation}
                    onSelectItem={(s) => setOperation(s as "copy" | "move")}
                    size="xs"
                    mr={3}
                    items={operationList.map((item) => ({
                      value: item.key,
                      label: (
                        <Flex align="center">
                          <Icon as={item.icon} mr={2} />
                          {item.label}
                        </Flex>
                      ),
                    }))}
                    withTooltip={false}
                  />
                  <Text>
                    <Trans
                      i18nKey="CopyOrMoveModal.content"
                      components={{
                        b: <b />,
                      }}
                      values={{
                        type: t(`CopyOrMoveModal.resourceType.${_tgtDirType}`),
                        name: srcResName,
                      }}
                    />
                  </Text>
                </Flex>
              </VStack>
              <RadioGroup
                value={selectedInstances[0]?.id}
                flexGrow="1"
                h="100%"
                overflow="auto"
                mt={2}
              >
                <OptionItemGroup items={instanceList.map(buildOptionItems)} />
              </RadioGroup>
            </Flex>
          </ModalBody>
        </Flex>

        <ModalFooter w="100%">
          <HStack spacing={3} ml="auto">
            <Button variant="ghost" onClick={modalProps.onClose}>
              {t("General.cancel")}
            </Button>
            <Button
              colorScheme={primaryColor}
              onClick={handleCopyOrMove}
              isLoading={isLoading}
              isDisabled={!selectedInstances.length}
            >
              {t("General.confirm")}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CopyOrMoveModal;

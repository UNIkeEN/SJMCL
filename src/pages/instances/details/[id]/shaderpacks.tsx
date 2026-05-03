import {
  Center,
  Flex,
  HStack,
  Icon,
  IconButton,
  Image,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronRight, LuHaze } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { WrapCardGroup } from "@/components/common/wrap-card";
import { ChangeLoaderModal } from "@/components/modals/change-loader-modal";
import { useFileDnD } from "@/components/special/file-dnd-overlay";
import { useLauncherConfig } from "@/contexts/config";
import { useExtensionHost } from "@/contexts/extension/host";
import { useInstanceSharedData } from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { ExtensionUISlotKey } from "@/enums/extension";
import { InstanceSubdirType } from "@/enums/instance";
import { OtherResourceType } from "@/enums/resource";
import { GetStateFlag } from "@/hooks/get-state";
import { ShaderPackInfo } from "@/models/instance/misc";
import { ResourceService } from "@/services/resource";

const InstanceShaderPacksPage = () => {
  const { config, update } = useLauncherConfig();
  const { t } = useTranslation();
  const {
    instanceId,
    summary,
    openInstanceSubdir,
    handleImportResource,
    getShaderPackList,
    isShaderPackListLoading: isLoading,
  } = useInstanceSharedData();
  const { getExtensionSlotItems } = useExtensionHost();
  const { openSharedModal } = useSharedModals();
  const accordionStates = config.states.instanceShaderPacksPage.accordionStates;

  const [shaderPacks, setShaderPacks] = useState<ShaderPackInfo[]>([]);

  const {
    isOpen: isChangeLoaderModalOpen,
    onOpen: onChangeLoaderModalOpen,
    onClose: onChangeLoaderModalClose,
  } = useDisclosure();

  const getShaderPackListWrapper = useCallback(
    (sync?: boolean) => {
      getShaderPackList(sync)
        .then((data) => {
          if (data === GetStateFlag.Cancelled) return;
          setShaderPacks(data || []);
        })
        .catch((e) => setShaderPacks([]));
    },
    [getShaderPackList]
  );

  useEffect(() => {
    getShaderPackListWrapper();
  }, [getShaderPackListWrapper]);

  useFileDnD({
    extensions: ["zip"],
    titleKey: "InstanceShaderPacksPage.fileDnD.title",
    descKey: "InstanceShaderPacksPage.fileDnD.desc",
    icon: LuHaze,
    onDrop: async (path) => {
      handleImportResource({
        filterName: t("InstanceDetailsLayout.instanceTabList.shaderpacks"),
        filterExt: ["zip"],
        tgtDirType: InstanceSubdirType.ShaderPacks,
        path,
        onSuccessCallback: () => getShaderPackListWrapper(true),
      });
    },
  });

  useEffect(() => {
    const unlisten = ResourceService.onResourceRefresh(
      (payload: OtherResourceType) => {
        if (payload === OtherResourceType.ShaderPack) {
          getShaderPackListWrapper(true);
        }
      }
    );
    return unlisten;
  }, [getShaderPackListWrapper]);

  const shaderSecMenuOperations = [
    {
      icon: "openFolder",
      onClick: () => {
        openInstanceSubdir(InstanceSubdirType.ShaderPacks);
      },
    },
    {
      icon: "download",
      onClick: () => {
        openSharedModal("download-resource", {
          initialResourceType: OtherResourceType.ShaderPack,
        });
      },
    },
    {
      icon: "add",
      onClick: () => {
        handleImportResource({
          filterName: t("InstanceDetailsLayout.instanceTabList.shaderpacks"),
          filterExt: ["zip"],
          tgtDirType: InstanceSubdirType.ShaderPacks,
          onSuccessCallback: () => getShaderPackListWrapper(true),
        });
      },
    },
    {
      icon: "refresh",
      onClick: () => getShaderPackListWrapper(true),
    },
  ];

  const shaderItemMenuOperations = (pack: ShaderPackInfo) => [
    ...getExtensionSlotItems(
      ExtensionUISlotKey.InstanceShaderPackItemMenuOperations,
      {
        pack,
        instanceId,
        summary,
      }
    ),
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

  const shaderLoaderCardItems = [
    {
      cardContent: (
        <Flex justify="space-between" align="center">
          <HStack spacing={2}>
            <Image
              src="/images/icons/OptiFine.png"
              alt="OptiFine"
              boxSize="28px"
              borderRadius="4px"
            />
            <VStack spacing={0} alignItems="start">
              <Text
                fontSize="xs-sm"
                fontWeight={
                  summary?.optifine?.status === "Installed" ? "bold" : "normal"
                }
                color={
                  summary?.optifine?.status === "Installed"
                    ? `${config.appearance.theme.primaryColor}.600`
                    : "inherit"
                }
              >
                OptiFine
              </Text>
              <Text fontSize="xs" className="secondary-text">
                {summary?.optifine?.status === "Installed"
                  ? summary?.optifine?.version
                  : t("InstanceShaderPacksPage.shaderLoaderList.notInstalled")}
              </Text>
            </VStack>
          </HStack>
          <HStack spacing={0}>
            <IconButton
              aria-label="select"
              icon={<Icon as={LuChevronRight} boxSize={3.5} />}
              variant="ghost"
              size="xs"
              onClick={onChangeLoaderModalOpen}
            />
          </HStack>
        </Flex>
      ),
      isSelected: summary?.optifine?.status === "Installed",
    },
  ];

  return (
    <>
      <Section
        title={t("InstanceShaderPacksPage.shaderLoaderList.title")}
        isAccordion
        initialIsOpen={accordionStates[0]}
        onAccordionToggle={(isOpen) => {
          update(
            "states.instanceShaderPacksPage.accordionStates",
            accordionStates.toSpliced(0, 1, isOpen)
          );
        }}
      >
        <WrapCardGroup items={shaderLoaderCardItems} />
      </Section>
      <Section
        title={t("InstanceShaderPacksPage.shaderPackList.title")}
        isAccordion
        initialIsOpen={accordionStates[0]}
        onAccordionToggle={(isOpen) => {
          update(
            "states.instanceShaderPacksPage.accordionStates",
            accordionStates.toSpliced(1, 1, isOpen)
          );
        }}
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
        {isLoading ? (
          <Center mt={4}>
            <BeatLoader size={16} color="gray" />
          </Center>
        ) : shaderPacks.length > 0 ? (
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
      <ChangeLoaderModal
        isOpen={isChangeLoaderModalOpen}
        onClose={onChangeLoaderModalClose}
        mode="optifine"
      />
    </>
  );
};

export default InstanceShaderPacksPage;

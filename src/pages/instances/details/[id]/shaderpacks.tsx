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
import SelectableCard, {
  SelectableCardProps,
} from "@/components/common/selectable-card";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { InstanceSubdirType } from "@/enums/instance";
import { OtherResourceType } from "@/enums/resource";
import { GetStateFlag } from "@/hooks/get-state";
import { ShaderPackInfo } from "@/models/instance/misc";
import { ResourceService } from "@/services/resource";

const InstanceShaderPacksPage = () => {
  const { config, update } = useLauncherConfig();
  const { t } = useTranslation();
  const {
    summary,
    openInstanceSubdir,
    handleImportResource,
    getShaderPackList,
    isShaderPackListLoading: isLoading,
  } = useInstanceSharedData();
  const { openSharedModal } = useSharedModals();
  const accordionStates = config.states.instanceShaderPacksPage.accordionStates;

  const [shaderPacks, setShaderPacks] = useState<ShaderPackInfo[]>([]);

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
          decompress: false,
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

  const selectableCardItems: SelectableCardProps[] = [
    {
      title: "OptiFine",
      iconSrc: "/images/icons/OptiFine.png",
      description:
        summary?.optifine?.status === "Installed"
          ? summary?.optifine?.version
          : t("InstanceShaderPacksPage.shaderLoaderList.notInstalled"),
      displayMode: "entry",
      isSelected: summary?.optifine?.status === "Installed",
      onSelect: () => {},
      // TODO: add OptiFine installation support
      isDisabled: true,
      isChevronShown: false,
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
        <HStack spacing={3.5} w="100%">
          {selectableCardItems.map((item, index) => (
            <SelectableCard
              key={index}
              {...item}
              flex={1}
              minH="max-content"
              h="100%"
            />
          ))}
        </HStack>
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
    </>
  );
};

export default InstanceShaderPacksPage;

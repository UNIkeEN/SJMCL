import { Center, HStack, Image } from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuPackage } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { FormattedMCText } from "@/components/common/formatted-mc-text";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useFileDnD } from "@/components/special/file-dnd-overlay";
import { useLauncherConfig } from "@/contexts/config";
import { useExtensionHost } from "@/contexts/extension/host";
import { useInstanceSharedData } from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { ExtensionUISlotKey } from "@/enums/extension";
import { InstanceSubdirType } from "@/enums/instance";
import { OtherResourceType } from "@/enums/resource";
import { GetStateFlag } from "@/hooks/get-state";
import { ResourcePackInfo } from "@/models/instance/misc";
import { ResourceService } from "@/services/resource";
import { base64ImgSrc } from "@/utils/string";

const InstanceResourcePacksPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const {
    instanceId,
    summary,
    openInstanceSubdir,
    handleImportResources,
    getResourcePackList,
    isResourcePackListLoading,
    getServerResourcePackList,
    isServerResourcePackListLoading,
  } = useInstanceSharedData();
  const { getExtensionSlotItems } = useExtensionHost();
  const accordionStates =
    config.states.instanceResourcePacksPage.accordionStates;
  const { openSharedModal } = useSharedModals();

  const [resourcePacks, setResourcePacks] = useState<ResourcePackInfo[]>([]);
  const [serverResPacks, setServerResPacks] = useState<ResourcePackInfo[]>([]);

  const getResourcePackListWrapper = useCallback(
    (sync?: boolean) => {
      getResourcePackList(sync)
        .then((data) => {
          if (data === GetStateFlag.Cancelled) return;
          setResourcePacks(data || []);
        })
        .catch((e) => setResourcePacks([]));
    },
    [getResourcePackList]
  );

  useEffect(() => {
    getResourcePackListWrapper();
  }, [getResourcePackListWrapper]);

  const getServerResourcePackListWrapper = useCallback(
    (sync?: boolean) => {
      getServerResourcePackList(sync)
        .then((data) => {
          if (data === GetStateFlag.Cancelled) return;
          setServerResPacks(data || []);
        })
        .catch((e) => setServerResPacks([]));
    },
    [getServerResourcePackList]
  );

  useEffect(() => {
    getServerResourcePackListWrapper();
  }, [getServerResourcePackListWrapper]);

  useFileDnD({
    extensions: ["zip"],
    multiple: true,
    titleKey: "InstanceResourcePacksPage.fileDnD.title",
    descKey: "InstanceResourcePacksPage.fileDnD.desc",
    icon: LuPackage,
    onDrop: async (paths) => {
      handleImportResources({
        filterName: t("InstanceDetailsLayout.instanceTabList.resourcepacks"),
        filterExt: ["zip"],
        tgtDirType: InstanceSubdirType.ResourcePacks,
        paths,
        multiple: true,
        onSuccessCallback: () => getResourcePackListWrapper(true),
      });
    },
  });

  useEffect(() => {
    const unlisten = ResourceService.onResourceRefresh(
      (payload: OtherResourceType) => {
        if (payload === OtherResourceType.ResourcePack) {
          getResourcePackListWrapper(true);
          getServerResourcePackListWrapper(true);
        }
      }
    );
    return unlisten;
  }, [getResourcePackListWrapper, getServerResourcePackListWrapper]);

  const defaultIcon = "/images/icons/DefaultPack.webp";

  const renderSections = {
    global: {
      data: resourcePacks,
      isLoading: isResourcePackListLoading,
      locale: "resourcePackList",
      secMenu: [
        {
          icon: "openFolder",
          onClick: () => {
            openInstanceSubdir(InstanceSubdirType.ResourcePacks);
          },
        },
        {
          icon: "download",
          onClick: () => {
            openSharedModal("download-resource", {
              initialResourceType: OtherResourceType.ResourcePack,
            });
          },
        },
        {
          icon: "add",
          onClick: () => {
            handleImportResources({
              filterName: t(
                "InstanceDetailsLayout.instanceTabList.resourcepacks"
              ),
              filterExt: ["zip"],
              tgtDirType: InstanceSubdirType.ResourcePacks,
              multiple: true,
              onSuccessCallback: () => getResourcePackListWrapper(true),
            });
          },
        },
        {
          icon: "refresh",
          onClick: () => getResourcePackListWrapper(true),
        },
      ],
    },
    server: {
      data: serverResPacks,
      isLoading: isServerResourcePackListLoading,
      locale: "serverResPackList",
      secMenu: [
        {
          icon: "refresh",
          onClick: () => getServerResourcePackListWrapper(true),
        },
      ],
    },
  };

  const resourcePackItemMenuOperations = (pack: ResourcePackInfo) => [
    ...getExtensionSlotItems(
      ExtensionUISlotKey.InstanceResourcePackItemMenuOperations,
      {
        pack,
        instanceId,
        summary,
      }
    ),
    {
      icon: "copyOrMove",
      onClick: () => {
        openSharedModal("copy-or-move", {
          srcResName: pack.name,
          srcFilePath: pack.filePath,
        });
      },
    },
    {
      icon: "revealFile",
      onClick: () => revealItemInDir(pack.filePath),
    },
  ];

  const serverResPackItemMenuOperations = (pack: ResourcePackInfo) => [
    ...getExtensionSlotItems(
      ExtensionUISlotKey.InstanceServerResPackItemMenuOperations,
      {
        pack,
        instanceId,
        summary,
      }
    ),
    {
      icon: "revealFile",
      onClick: () => revealItemInDir(pack.filePath),
    },
  ];

  return (
    <>
      {Object.entries(renderSections).map(([key, value], index) => {
        return (
          <Section
            key={key}
            title={t(`InstanceResourcePacksPage.${value.locale}.title`)}
            isAccordion
            initialIsOpen={accordionStates[index]}
            titleExtra={<CountTag count={value.data.length} />}
            onAccordionToggle={(isOpen) => {
              update(
                "states.instanceResourcepacksPage.accordionStates",
                accordionStates.toSpliced(index, 1, isOpen)
              );
            }}
            headExtra={
              <HStack spacing={2}>
                {value.secMenu.map((btn, index) => (
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
            {value.isLoading ? (
              <Center mt={4}>
                <BeatLoader size={16} color="gray" />
              </Center>
            ) : value.data.length > 0 ? (
              <OptionItemGroup
                items={value.data.map((pack) => (
                  <OptionItem
                    key={pack.name}
                    title={pack.name}
                    description={
                      <FormattedMCText fontSize="xs" className="secondary-text">
                        {pack.description}
                      </FormattedMCText>
                    }
                    prefixElement={
                      <Image
                        src={
                          pack.iconSrc
                            ? base64ImgSrc(pack.iconSrc)
                            : defaultIcon
                        }
                        alt={pack.name}
                        boxSize="28px"
                        style={{ borderRadius: "4px" }}
                        onError={(e) => {
                          e.currentTarget.src = defaultIcon;
                        }}
                      />
                    }
                  >
                    <HStack spacing={0}>
                      {(value.locale === "resourcePackList"
                        ? resourcePackItemMenuOperations(pack)
                        : serverResPackItemMenuOperations(pack)
                      ).map((item, index) => (
                        <CommonIconButton
                          key={index}
                          icon={item.icon}
                          label={item.label}
                          onClick={item.onClick}
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
      })}
    </>
  );
};

export default InstanceResourcePacksPage;

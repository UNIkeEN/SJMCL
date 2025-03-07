import { HStack, Image } from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { FormattedMCText } from "@/components/common/formatted-mc-text";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { InstanceSubdirEnums } from "@/enums/instance";
import { ResourcePackInfo } from "@/models/instance/misc";
import { base64ImgSrc } from "@/utils/string";

const InstanceResourcePacksPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const {
    summary,
    openSubdir,
    getResourcePackList,
    getServerResourcePackList,
  } = useInstanceSharedData();
  const accordionStates =
    config.states.instanceResourcepackPage.accordionStates;
  const { openSharedModal } = useSharedModals();

  const [resourcePacks, setResourcePacks] = useState<ResourcePackInfo[]>([]);
  const [serverResPacks, setServerResPacks] = useState<ResourcePackInfo[]>([]);

  useEffect(() => {
    setResourcePacks(getResourcePackList() || []);
    setServerResPacks(getServerResourcePackList() || []);
  }, [getResourcePackList, getServerResourcePackList]);

  const defaultIcon = "/images/icons/DefaultPack.webp";

  const renderSections = {
    global: {
      data: resourcePacks,
      locale: "resourcePackList",
      secMenu: [
        {
          icon: "openFolder",
          onClick: () => {
            openSubdir(InstanceSubdirEnums.ResourcePacks);
          },
        },
        {
          icon: "add",
          onClick: () => {},
        },
        {
          icon: "download",
          onClick: () => {
            openSharedModal("download-resource", {
              initialResourceType: "resourcepack",
            });
          },
        },
        {
          icon: "refresh",
          onClick: () => {
            setResourcePacks(getResourcePackList(true) || []);
          },
        },
      ],
    },
    server: {
      data: serverResPacks,
      locale: "serverResPackList",
      secMenu: [
        {
          icon: "refresh",
          onClick: () => {
            setServerResPacks(getServerResourcePackList(true) || []);
          },
        },
      ],
    },
  };

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
                "states.instanceResourcepackPage.accordionStates",
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
            {value.data.length > 0 ? (
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
                      {value.locale === "resourcePackList" && (
                        <CommonIconButton
                          icon="copyOrMove"
                          onClick={() => {
                            openSharedModal("copy-or-move", {
                              srcResName: pack.name,
                              srcFilePath: pack.filePath,
                            });
                          }}
                        />
                      )}
                      <CommonIconButton
                        icon="revealFile"
                        onClick={() => revealItemInDir(pack.filePath)}
                      />
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

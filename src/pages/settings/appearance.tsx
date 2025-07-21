import {
  Badge,
  Card,
  Center,
  HStack,
  Icon,
  IconButton,
  Image,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Switch,
  Text,
  Tooltip,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuPlus, LuTrash } from "react-icons/lu";
import ChakraColorSelector from "@/components/chakra-color-selector";
import { MenuSelector } from "@/components/common/menu-selector";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import SegmentedControl from "@/components/common/segmented";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { ConfigService } from "@/services/config";
import { retrieveFontList } from "@/services/utils";
import { removeFileExt } from "@/utils/string";

const AppearanceSettingsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const toast = useToast();
  const appearanceConfigs = config.appearance;
  const primaryColor = appearanceConfigs.theme.primaryColor;
  const selectedBgKey = appearanceConfigs.background.choice.replace(
    "%built-in:",
    ""
  );

  const [customBgList, setCustomBgList] = useState<Record<string, string>[]>(
    []
  );

  const handleRetrieveCustomBackgroundList = useCallback(() => {
    appDataDir()
      .then((_appDataDir) => {
        ConfigService.retrieveCustomBackgroundList().then((response) => {
          if (response.status === "success") {
            const list = response.data;
            const updatedList = list.map((bg) => ({
              fileName: bg,
              fullPath: `${_appDataDir}/UserContent/Backgrounds/${bg}`,
            }));
            setCustomBgList(updatedList);
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
            setCustomBgList([]);
          }
        });
      })
      .catch(() => {
        setCustomBgList([]);
      });
  }, [toast]);

  useEffect(() => {
    handleRetrieveCustomBackgroundList();
  }, [handleRetrieveCustomBackgroundList]);

  const handleAddCustomBackground = () => {
    open({
      multiple: false,
      filters: [
        {
          name: t("General.dialog.filterName.image"),
          extensions: ["jpg", "jpeg", "png", "gif", "webp"],
        },
      ],
    })
      .then((selectedPath) => {
        if (!selectedPath) return;
        ConfigService.addCustomBackground(selectedPath).then((response) => {
          if (response.status === "success") {
            handleRetrieveCustomBackgroundList();
            // set selected background to the new added one.
            update("appearance.background.choice", response.data);
            toast({
              title: response.message,
              status: "success",
            });
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        });
      })
      .catch(() => {});
  };

  const handleDeleteCustomBackground = (fileName: string) => {
    ConfigService.deleteCustomBackground(fileName).then((response) => {
      if (response.status === "success") {
        toast({
          title: response.message,
          status: "success",
        });

        // set the next bgKey (custom+1 > custom-1 > default) if current choice is deleted
        if (fileName === selectedBgKey) {
          const deletedIndex = customBgList.findIndex(
            (bg) => bg.fileName === fileName
          );

          let newSelectedBgKey;
          if (customBgList.length === 1) {
            newSelectedBgKey = "%built-in:Jokull";
            if (appearanceConfigs.background.randomCustom)
              update("appearance.background.randomCustom", false);
          } else {
            newSelectedBgKey =
              deletedIndex < customBgList.length - 1
                ? customBgList[deletedIndex + 1].fileName
                : customBgList[deletedIndex - 1].fileName;
          }
          update("appearance.background.choice", newSelectedBgKey);
        }

        // refresh custom bg list state
        handleRetrieveCustomBackgroundList();
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  };

  const ColorSelectPopover = () => {
    return (
      <Popover>
        <PopoverTrigger>
          <IconButton
            size="xs"
            colorScheme={primaryColor}
            aria-label="color"
            icon={<LuChevronDown />}
          />
        </PopoverTrigger>
        <PopoverContent>
          <PopoverBody>
            <ChakraColorSelector
              current={primaryColor}
              onColorSelect={(color) => {
                update("appearance.theme.primaryColor", color);
              }}
              size="xs"
            />
          </PopoverBody>
        </PopoverContent>
      </Popover>
    );
  };

  const HeadNavStyleMenu = () => {
    const headNavStyleTypes = ["standard", "simplified"];

    return (
      <MenuSelector
        options={headNavStyleTypes.map((type) => ({
          value: type,
          label: t(
            `AppearanceSettingsPage.theme.settings.headNavStyle.type.${type}`
          ),
        }))}
        value={appearanceConfigs.theme.headNavStyle}
        onSelect={(value) =>
          update("appearance.theme.headNavStyle", value as string)
        }
        placeholder={t(
          `AppearanceSettingsPage.theme.settings.headNavStyle.type.${appearanceConfigs.theme.headNavStyle}`
        )}
      />
    );
  };

  const FontFamilyMenu = () => {
    const [fonts, setFonts] = useState<string[]>([]);

    useEffect(() => {
      const handleRetrieveFontList = async () => {
        const res = await retrieveFontList();
        setFonts(["%built-in", ...res]);
      };
      handleRetrieveFontList();
    }, []);

    const buildFontName = (font: string) => {
      return font === "%built-in"
        ? t("AppearanceSettingsPage.font.settings.fontFamily.default")
        : font;
    };

    return (
      <MenuSelector
        options={fonts.map((font) => ({
          value: font,
          label: (
            <Text
              fontFamily={font === "%built-in" ? "-apple-system, Sinter" : font}
              fontSize="xs"
            >
              {buildFontName(font)}
            </Text>
          ),
        }))}
        value={buildFontName(appearanceConfigs.font.fontFamily)}
        onSelect={(value) =>
          update("appearance.font.fontFamily", value as string)
        }
        placeholder={buildFontName(appearanceConfigs.font.fontFamily)}
        menuListProps={{ maxH: "40vh", overflowY: "auto" }}
      />
    );
  };

  const FontSizeSlider = () => {
    return (
      <HStack spacing={2}>
        <Text fontSize="10.88px">
          {" "}
          {/* 85% */}
          {t("AppearanceSettingsPage.font.settings.fontSize.small")}
        </Text>
        <Slider
          value={appearanceConfigs.font.fontSize}
          min={85}
          max={115}
          step={5}
          w={32}
          colorScheme={primaryColor}
          onChange={(value) => {
            update("appearance.font.fontSize", value);
          }}
        >
          <SliderTrack>
            <SliderFilledTrack />
          </SliderTrack>
          <SliderThumb />
        </Slider>
        <Text fontSize="14.72px">
          {" "}
          {/* 115% */}
          {t("AppearanceSettingsPage.font.settings.fontSize.large")}
        </Text>
      </HStack>
    );
  };

  interface BackgroundCardProps {
    bgAlt: string;
    bgSrc: string;
    selected: boolean;
    onSelect: () => void;
    label: string;
    extra?: React.ReactNode;
    extraOnHover?: React.ReactNode;
  }

  const BackgroundCard: React.FC<BackgroundCardProps> = ({
    bgAlt,
    bgSrc,
    selected,
    onSelect,
    label,
    extra,
    extraOnHover,
  }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <VStack spacing={1}>
        <Card
          w="6rem"
          h="3.375rem"
          {...(selected && {
            boxShadow: `0 0 0 1.5px var(--chakra-colors-${primaryColor}-500)`,
          })}
          overflow="hidden"
          cursor="pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Image
            w="100%"
            h="100%"
            src={bgSrc}
            alt={bgAlt}
            objectFit="cover"
            position="absolute"
            borderRadius="sm"
            onClick={onSelect}
          />
          {extra}
          {isHovered && extraOnHover}
        </Card>
        <Text
          maxW="6rem"
          fontSize="xs"
          className={!selected ? "secondary-text" : ""}
          mt={selected ? "-1px" : 0} // compensate for the offset caused by selected card's border
          noOfLines={1}
        >
          {label}
        </Text>
      </VStack>
    );
  };

  const PresetBackgroundList = () => {
    const presetBgList = ["Jokull", "SJTU-eastgate", "GNLXC"];

    return (
      <Wrap spacing={3.5} justify="right">
        {presetBgList.map((bg) => (
          <WrapItem key={bg}>
            <BackgroundCard
              bgAlt={bg}
              bgSrc={`/images/backgrounds/${bg}.jpg`}
              selected={selectedBgKey === bg}
              onSelect={() =>
                update("appearance.background.choice", `%built-in:${bg}`)
              }
              label={t(
                `AppearanceSettingsPage.background.presetBgList.${bg}.name`
              )}
            />
          </WrapItem>
        ))}
      </Wrap>
    );
  };

  const CustomBackgroundList = () => {
    return (
      <Wrap spacing={3.5} justify="right">
        {customBgList.map((bg) => (
          <WrapItem key={bg.fileName}>
            <BackgroundCard
              bgAlt={bg.fileName}
              bgSrc={convertFileSrc(bg.fullPath)}
              selected={selectedBgKey === bg.fileName}
              onSelect={() =>
                update("appearance.background.choice", bg.fileName)
              }
              label={removeFileExt(bg.fileName)}
              extraOnHover={
                <Tooltip label={t("General.delete")} placement="top">
                  <IconButton
                    icon={<Icon as={LuTrash} />}
                    aria-label="delete"
                    size="xs"
                    colorScheme="blackAlpha"
                    position="absolute"
                    top={1}
                    right={1}
                    onClick={() => handleDeleteCustomBackground(bg.fileName)}
                  />
                </Tooltip>
              }
            />
          </WrapItem>
        ))}
        <WrapItem>
          <VStack spacing={1}>
            <Card
              w="6rem"
              h="3.375rem"
              borderWidth={1}
              borderStyle="dashed"
              borderColor="gray.400"
              bgColor="transparent"
              variant="outline"
              overflow="hidden"
              cursor="pointer"
              onClick={handleAddCustomBackground}
            >
              <Center h="100%" color={`${primaryColor}.500`}>
                <LuPlus />
              </Center>
            </Card>
            <Text fontSize="xs" className="secondary-text">
              {t("AppearanceSettingsPage.background.settings.custom.add")}
            </Text>
          </VStack>
        </WrapItem>
      </Wrap>
    );
  };

  const appearanceSettingGroups: OptionItemGroupProps[] = [
    {
      title: t("AppearanceSettingsPage.theme.title"),
      items: [
        {
          title: t("AppearanceSettingsPage.theme.settings.primaryColor.title"),
          children: <ColorSelectPopover />,
        },
        {
          title: t("AppearanceSettingsPage.theme.settings.colorMode.title"),
          children: (
            <SegmentedControl
              selected={appearanceConfigs.theme.colorMode}
              onSelectItem={(s) => {
                update("appearance.theme.colorMode", s as string);
              }}
              size="xs"
              items={["system", "light", "dark"].map((item) => ({
                label: t(
                  `AppearanceSettingsPage.theme.settings.colorMode.type.${item}`
                ),
                value: item,
              }))}
            />
          ),
        },
        {
          title: t(
            "AppearanceSettingsPage.theme.settings.useLiquidGlassDesign.title"
          ),
          titleExtra: <Badge colorScheme="purple">Beta</Badge>,
          description: t(
            "AppearanceSettingsPage.theme.settings.useLiquidGlassDesign.description"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={appearanceConfigs.theme.useLiquidGlassDesign}
              onChange={(e) => {
                update(
                  "appearance.theme.useLiquidGlassDesign",
                  e.target.checked
                );
              }}
            />
          ),
        },
        {
          title: t("AppearanceSettingsPage.theme.settings.headNavStyle.title"),
          children: <HeadNavStyleMenu />,
        },
      ],
    },

    {
      title: t("AppearanceSettingsPage.font.title"),
      items: [
        {
          title: t("AppearanceSettingsPage.font.settings.fontFamily.title"),
          children: <FontFamilyMenu />,
        },
        // font size settings cannot work in Windows now: https://github.com/UNIkeEN/SJMCL/issues/376
        ...(config.basicInfo.osType !== "windows"
          ? [
              {
                title: t("AppearanceSettingsPage.font.settings.fontSize.title"),
                children: <FontSizeSlider />,
              },
            ]
          : []),
      ],
    },
    {
      title: t("AppearanceSettingsPage.background.title"),
      items: [
        {
          title: t("AppearanceSettingsPage.background.settings.preset.title"),
          children: <PresetBackgroundList />,
        },
        {
          title: t("AppearanceSettingsPage.background.settings.custom.title"),
          children: <CustomBackgroundList />,
        },
        {
          title: t(
            "AppearanceSettingsPage.background.settings.randomCustom.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={appearanceConfigs.background.randomCustom}
              disabled={customBgList.length === 0}
              onChange={(e) => {
                update("appearance.background.randomCustom", e.target.checked);
                if (
                  e.target.checked &&
                  appearanceConfigs.background.choice.startsWith("%built-in:")
                ) {
                  update(
                    "appearance.background.choice",
                    customBgList[
                      Math.floor(Math.random() * customBgList.length)
                    ]?.fileName
                  );
                }
              }}
            />
          ),
        },
      ],
    },
    {
      title: t("AppearanceSettingsPage.accessibility.title"),
      items: [
        {
          title: t(
            "AppearanceSettingsPage.accessibility.settings.invertColors.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={appearanceConfigs.accessibility.invertColors}
              onChange={(e) => {
                update(
                  "appearance.accessibility.invertColors",
                  e.target.checked
                );
              }}
            />
          ),
        },
        {
          title: t(
            "AppearanceSettingsPage.accessibility.settings.enhanceContrast.title"
          ),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={appearanceConfigs.accessibility.enhanceContrast}
              onChange={(e) => {
                update(
                  "appearance.accessibility.enhanceContrast",
                  e.target.checked
                );
              }}
            />
          ),
        },
      ],
    },
  ];

  return (
    <>
      {appearanceSettingGroups.map((group, index) => (
        <OptionItemGroup title={group.title} items={group.items} key={index} />
      ))}
    </>
  );
};

export default AppearanceSettingsPage;

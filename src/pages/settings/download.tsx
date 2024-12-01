import { useTranslation } from 'react-i18next';
import {
  HStack,
  Switch,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Button,
  FormControl,
  Menu,
  MenuButton,
  MenuList,
  MenuOptionGroup,
  MenuItemOption,
  Text
} from '@chakra-ui/react';
import { OptionItemGroupProps, OptionItemGroup } from "@/components/common/option-item";
import { FiChevronDown } from "react-icons/fi";

const DownloadSettingsPage = () => {
  const { t } = useTranslation();
  const directoryName = "/mock/path/to/cache/";

  const downloadSettingGroups: OptionItemGroupProps[] = [
    {
      title: t("DownloadSettingPage.source.title"),
      items: [
        {
          title: t("DownloadSettingPage.source.settings.strategy.title"),
          children: (
            <HStack spacing={4}>
              <Menu>
                <MenuButton 
                  as={Button} size="xs" w="auto"
                  rightIcon={<FiChevronDown />} 
                  variant="outline"
                  textAlign="left"
                >
                  {t("DownloadSettingPage.source.settings.strategy.auto")} 
                </MenuButton>
                <MenuList>
                  <MenuOptionGroup
                    value="auto"
                    onChange={() => {}}
                    type="radio" 
                  >
                    <MenuItemOption value="auto" fontSize="xs">
                      {t("DownloadSettingPage.source.settings.strategy.auto")}
                    </MenuItemOption>
                    <MenuItemOption value="official" fontSize="xs">
                      {t("DownloadSettingPage.source.settings.strategy.official")}
                    </MenuItemOption>
                    <MenuItemOption value="mirror" fontSize="xs">
                      {t("DownloadSettingPage.source.settings.strategy.mirror")}
                    </MenuItemOption>
                  </MenuOptionGroup>
                </MenuList>
              </Menu>
            </HStack>
          )
        }
      ]
    },
    {
      title: t("DownloadSettingPage.download.title"),
      items: [
        {
          title: t("DownloadSettingPage.download.settings.autoconcurrent.title"),
          children: (
            <HStack spacing={4}>
              <FormControl display="flex" alignItems="center">
                <Switch id="auto-concurrent" isChecked={false} onChange={() => {}} />
              </FormControl>
            </HStack>
          )
        },
        {
          title: t("DownloadSettingPage.download.settings.countconcurrent.title"),
          children: (
            <HStack spacing={4}>
              <Slider 
                defaultValue={8} 
                min={1} 
                max={128} 
                step={1} 
                width="150px"
                value={8} 
                onChange={() => {}}
                isDisabled={false}
              >
                <SliderTrack>
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb />
              </Slider>
              <NumberInput 
                min={1} 
                max={128} 
                defaultValue={8} 
                value={8} 
                onChange={() => {}}
                isDisabled={false}
                width="80px"
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </HStack>
          )
        },
        {
          title: t("DownloadSettingPage.download.settings.speedenable.title"),
          children: (
            <HStack spacing={4}>
              <FormControl display="flex" alignItems="center">
                <Switch id="speed-limit" isChecked={false} onChange={() => {}} />
              </FormControl>
            </HStack>
          )
        },
        {
          title: t("DownloadSettingPage.download.settings.speedlimit.title"),
          children: (
            <HStack spacing={4} width="120px">
              <FormControl display="flex" alignItems="center">
                <NumberInput 
                  min={1} 
                  max={1000} 
                  value={50} 
                  onChange={() => {}}
                  isDisabled={false}
                >
                  <NumberInputField />
                </NumberInput>
                <Text ml={2} fontSize="sm">{"KB/s"}</Text>
              </FormControl>
            </HStack>
          )
        }
      ]
    },
    {
      title: t("DownloadSettingPage.cache.title"),
      items: [
        {
          title: t("DownloadSettingPage.cache.settings.directory.title"),
          description: directoryName,
          children: (
            <HStack>
              <Button colorScheme="gray" fontSize="xs" w="auto" variant="outline" textAlign="left">
                {t("DownloadSettingPage.cache.settings.directory.select")}
              </Button>
              <Button colorScheme="gray" fontSize="xs" w="auto" variant="outline" textAlign="left">
                {t("DownloadSettingPage.cache.settings.directory.open")}
              </Button>
            </HStack>
          ),
        }
      ]
    }
  ];

  return (
    <>
      {downloadSettingGroups.map((group, index) => (
        <OptionItemGroup title={group.title} items={group.items} key={index} />
      ))}
    </>
  );
}

export default DownloadSettingsPage;

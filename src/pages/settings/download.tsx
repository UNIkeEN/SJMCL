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
import { useState, useEffect } from 'react';
import { FiChevronDown } from "react-icons/fi";

const DownloadSettingsPage = () => {
  const { t } = useTranslation();

  const [autoConcurrent, setAutoConcurrent] = useState(true);
  const [concurrentCount, setConcurrentCount] = useState(8); 
  const [downloadSource, setDownloadSource] = useState("auto");
  const [speedLimitEnabled, setSpeedLimitEnabled] = useState(false); 
  const [speedLimit, setSpeedLimit] = useState(50); 

  useEffect(() => {
    const savedDownloadSource = localStorage.getItem('downloadSource');
    if (savedDownloadSource) {
      setDownloadSource(savedDownloadSource); 
    }
  }, []);

  const handleConcurrentChange = (value: number) => {
    if (!autoConcurrent) {
      setConcurrentCount(value);
    }
  };

  const handleSpeedLimitChange = (value: number) => {
    setSpeedLimit(value < 1 ? 1 : value); 
  };

  const handleAutoConcurrentChange = (checked: boolean) => {
    setAutoConcurrent(checked);
    if (checked) {
      setConcurrentCount(8); 
    }
  };

  const handleDownloadSourceChange = (strategy: string) => {
    setDownloadSource(strategy);
    localStorage.setItem('downloadSource', strategy); 
  };

  const handleSpeedLimitToggle = (checked: boolean) => {
    setSpeedLimitEnabled(checked);
    if (checked) {
      setSpeedLimit(50); 
    } else {
      setSpeedLimit(0); 
    }
  };

  const downloadSettingGroups: OptionItemGroupProps[] = [
    {
      title: t("Page.download.settings.source.title"),
      items: [
        {
          title: t("Page.download.settings.source.strategy"),
          children: (
            <HStack spacing={4}>
              <Menu>
                <MenuButton 
                  as={Button} size="xs" w="auto"
                  rightIcon={<FiChevronDown/>} 
                  variant="outline"
                  textAlign="left"
                >
                  {t(`Page.download.settings.source.${downloadSource}`)} 
                </MenuButton>
                <MenuList>
                  <MenuOptionGroup
                    value={downloadSource}
                    onChange={(value) => handleDownloadSourceChange(value as string)} 
                    type="radio" 
                  >
                    <MenuItemOption value="auto" fontSize="xs">{t("Page.download.settings.source.auto")}</MenuItemOption>
                    <MenuItemOption value="official" fontSize="xs">{t("Page.download.settings.source.official")}</MenuItemOption>
                    <MenuItemOption value="mirror" fontSize="xs">{t("Page.download.settings.source.mirror")}</MenuItemOption>
                  </MenuOptionGroup>
                </MenuList>
              </Menu>
            </HStack>
          )
        }
      ]
    },
    {
      title: t("Page.download.settings.download.title"),
      items: [
        {
          title: t("Page.download.settings.autoconcurrent.title"),
          children: (
            <HStack spacing={4}>
              <FormControl display="flex" alignItems="center">
                <Switch id="auto-concurrent" isChecked={autoConcurrent} onChange={(e) => handleAutoConcurrentChange(e.target.checked)} />
              </FormControl>
            </HStack>
          )
        },
        {
          title: t("Page.download.settings.countconcurrent.title"),
          children: (
            <HStack spacing={4}>
              <Slider 
                defaultValue={8} 
                min={1} 
                max={128} 
                step={1} 
                width="150px"
                value={autoConcurrent ? 8 : concurrentCount} 
                onChange={handleConcurrentChange}
                isDisabled={autoConcurrent}
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
                value={autoConcurrent ? 8 : concurrentCount} 
                onChange={(value) => handleConcurrentChange(Number(value))}
                isDisabled={autoConcurrent}
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
          title: t("Page.download.settings.speedenable.title"),
          children: (
            <HStack spacing={4}>
              <FormControl display="flex" alignItems="center">
                <Switch id="speed-limit" isChecked={speedLimitEnabled} onChange={(e) => handleSpeedLimitToggle(e.target.checked)} />
              </FormControl>
            </HStack>
          )
        },
        {
          title: t("Page.download.settings.speedlimit.title"),
          children: (
            <HStack spacing={4} width="120px">
              <FormControl display="flex" alignItems="center">
                <NumberInput 
                  min={1} 
                  max={1000} 
                  value={speedLimit} 
                  onChange={(value) => handleSpeedLimitChange(Number(value))}
                  isDisabled={speedLimitEnabled}
                >
                  <NumberInputField />
                </NumberInput>
                <Text ml={2} fontSize="sm">{t("KB/s")}</Text>
              </FormControl>
            </HStack>
          )
        }
      ]
    },
    {
      title: t("Page.download.settings.cache.title"),
      items: [
        {
          title: t("Page.download.settings.cachedirectory.title"),
          description: t("Page.download.settings.cachedirectory.description"),
          children: (
            <HStack spacing={2}>
              <Button colorScheme="gray" fontSize="xs" w="auto" variant="outline" textAlign="left">
                {t("Page.download.settings.cachedirectory.select")}
              </Button>
              <Button colorScheme="gray" fontSize="xs" w="auto" variant="outline" textAlign="left">
                {t("Page.download.settings.cachedirectory.open")}
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
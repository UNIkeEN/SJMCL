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
  VStack,
  FormControl,
  Input,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuOptionGroup,
  MenuItemOption,
  Text
} from '@chakra-ui/react';
import { OptionItemGroupProps, OptionItemGroup } from "@/components/common/option-item";
import { useState, useEffect } from 'react';

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
      title: t("DownloadSettingsPage.source.title"),
      items: [
        {
          title: t("DownloadSettingsPage.source.strategy.title"),
          children: (
            <HStack spacing={4}>
              <Menu>
                <MenuButton as={Button}>
                  {t(`DownloadSettingsPage.source.strategy.${downloadSource}`)} 
                </MenuButton>
                <MenuList>
                  <MenuOptionGroup
                    value={downloadSource} // Set the value to the current selected source
                    onChange={(value) => handleDownloadSourceChange(value as string)} // Update the download source
                    type="radio" // Ensure it behaves as a radio button group
                  >
                    <MenuItemOption value="auto">{t("DownloadSettingsPage.source.strategy.auto")}</MenuItemOption>
                    <MenuItemOption value="official">{t("DownloadSettingsPage.source.strategy.official")}</MenuItemOption>
                    <MenuItemOption value="mirror">{t("DownloadSettingsPage.source.strategy.mirror")}</MenuItemOption>
                  </MenuOptionGroup>
                </MenuList>
              </Menu>
            </HStack>
          )
        }
      ]
    },
    {
      title: t("DownloadSettingsPage.download.title"),
      items: [
        {
          title: t("DownloadSettingsPage.download.concurrent.auto.title"),
          children: (
            <HStack spacing={4}>
            <FormControl display="flex" alignItems="center">
              <Switch id="auto-concurrent" isChecked={autoConcurrent} onChange={(e) => handleAutoConcurrentChange(e.target.checked)} />
            </FormControl>
            </HStack>
          )
        },
        {
          title: t("DownloadSettingsPage.download.concurrent.count.title"),
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
          title: t("DownloadSettingsPage.download.speed.enable.title"),
          children: (
            <HStack spacing={4}>
            <FormControl display="flex" alignItems="center">
              <Switch id="speed-limit" isChecked={speedLimitEnabled} onChange={(e) => handleSpeedLimitToggle(e.target.checked)} />
            </FormControl>
            </HStack>
          )
        },
        {
          title: t("DownloadSettingsPage.download.speed.limit.title"),
          children: (
            <HStack spacing={4} width="80px">
            <FormControl>
              <Input 
                id="speed-limit-value" 
                type="number" 
                min={1} 
                value={speedLimitEnabled ? 50 : speedLimit} 
                onChange={(e) => handleSpeedLimitChange(Number(e.target.value))} 
                isDisabled={speedLimitEnabled}
              />
            </FormControl>
            </HStack>
          )
        }
      ]
    },
    {
      title: t("DownloadSettingsPage.cache.title"),
      items: [
        {
          title: t("DownloadSettingsPage.cache.directory.title"),
          children: (
            <VStack>
              <HStack spacing={4}>
                <Button colorScheme="gray">{t("DownloadSettingsPage.cache.directory.select.label")}</Button>
                <Button colorScheme="gray">{t("DownloadSettingsPage.cache.directory.open.label")}</Button>
              </HStack>
              <Text fontSize="sm" color="gray.500">{t("DownloadSettingsPage.cache.directory.description")}</Text>
            </VStack>
          )
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

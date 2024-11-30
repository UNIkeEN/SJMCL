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
  FormLabel, 
  Input, 
  Menu, 
  MenuButton, 
  MenuList, 
  MenuItem, 
  Text 
} from '@chakra-ui/react';
import { OptionItemGroupProps, OptionItemGroup, OptionItemProps } from "@/components/common/option-item";
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
              <Text>{t("DownloadSettingsPage.source.strategy.current")}: {t(`DownloadSettingsPage.source.strategy.${downloadSource}`)}</Text>
              <Menu>
                <MenuButton as={Button}>
                  {t("DownloadSettingsPage.source.strategy.select")}
                </MenuButton>
                <MenuList>
                  <MenuItem onClick={() => handleDownloadSourceChange("auto")}>{t("DownloadSettingsPage.source.strategy.auto")}</MenuItem>
                  <MenuItem onClick={() => handleDownloadSourceChange("official")}>{t("DownloadSettingsPage.source.strategy.official")}</MenuItem>
                  <MenuItem onClick={() => handleDownloadSourceChange("mirror")}>{t("DownloadSettingsPage.source.strategy.mirror")}</MenuItem>
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
          title: t("DownloadSettingsPage.download.concurrent.title"),
          children: (
            <VStack>
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="auto-concurrent" mb="0">{t("DownloadSettingsPage.download.concurrent.auto")}</FormLabel>
                <Switch id="auto-concurrent" isChecked={autoConcurrent} onChange={(e) => handleAutoConcurrentChange(e.target.checked)} />
              </FormControl>
              <HStack spacing={4}>
                <FormLabel>{t("DownloadSettingsPage.download.concurrent.count")}</FormLabel>
                <Slider 
                  defaultValue={8} 
                  min={1} 
                  max={128} 
                  step={1} 
                  width="200px"
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
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </HStack>
            </VStack>
          )
        },
        {
          title: t("DownloadSettingsPage.download.speed.title"),
          children: (
            <VStack>
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="speed-limit" mb="0">{t("DownloadSettingsPage.download.speed.enable")}</FormLabel>
                <Switch id="speed-limit" isChecked={speedLimitEnabled} onChange={(e) => handleSpeedLimitToggle(e.target.checked)} />
              </FormControl>
              <FormControl>
                <FormLabel htmlFor="speed-limit-value">{t("DownloadSettingsPage.download.speed.limit")}</FormLabel>
                <Input 
                  id="speed-limit-value" 
                  type="number" 
                  min={1} 
                  value={speedLimitEnabled ? 50 : speedLimit} 
                  onChange={(e) => handleSpeedLimitChange(Number(e.target.value))} 
                  isDisabled={speedLimitEnabled}
                />
              </FormControl>
            </VStack>
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
            <HStack>
              <Button colorScheme="gray">{t("DownloadSettingsPage.cache.directory.select")}</Button>
              <Button colorScheme="gray">{t("DownloadSettingsPage.cache.directory.open")}</Button>
            </HStack>
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

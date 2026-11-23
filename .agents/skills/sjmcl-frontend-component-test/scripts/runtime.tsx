import {
  Box,
  ChakraProvider,
  ColorMode,
  HStack,
  Heading,
  Select,
  useColorMode,
} from "@chakra-ui/react";
import i18n from "i18next";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { initReactI18next, useTranslation } from "react-i18next";
import SegmentedControl from "@/components/common/segmented";
import { ToastContextProvider } from "@/contexts/toast";
import { localeResources } from "@/locales";
import chakraExtendTheme from "@/styles/chakra-theme";
import "@/styles/globals.css";

function PreviewFrame({ Preview }: { Preview: ComponentType }) {
  const { colorMode, setColorMode } = useColorMode();
  const { i18n } = useTranslation();

  return (
    <Box h="100vh" overflow="auto" bg="chakra-body-bg" p={4}>
      <HStack mb={4} spacing={3} flexWrap="wrap">
        <Heading size="sm">SJMCL Frontend Preview</Heading>
        <SegmentedControl
          size="xs"
          items={[
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
          ]}
          selected={colorMode}
          onSelectItem={(value) => setColorMode(value as ColorMode)}
        />
        <Select
          aria-label="Language"
          size="sm"
          w="40"
          value={i18n.language}
          onChange={(e) => {
            i18n.changeLanguage(e.target.value);
            document.documentElement.lang =
              localeResources[e.target.value].htmlLang;
          }}
        >
          {Object.entries(localeResources).map(([key, locale]) => (
            <option key={key} value={key}>
              {locale.display_name}
            </option>
          ))}
        </Select>
      </HStack>
      <Preview />
    </Box>
  );
}

export async function mount(Preview: ComponentType) {
  await i18n.use(initReactI18next).init({
    resources: localeResources,
    lng: "zh-Hans",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

  createRoot(document.getElementById("root")!).render(
    <ChakraProvider theme={chakraExtendTheme}>
      <ToastContextProvider>
        <PreviewFrame Preview={Preview} />
      </ToastContextProvider>
    </ChakraProvider>
  );
}

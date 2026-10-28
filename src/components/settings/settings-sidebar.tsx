import { Badge, Box, Button, Flex, Input } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { LuChevronLeft } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";

// easy-launcher settings sidebar (docs/design/DESIGN-settings.md):
// 240px column — back button, search field, text-only category tabs.
// Shared by the single settings page (with search) and the leftover
// special routes (extension / ping-test, without search).

export const SETTINGS_TABS = [
  "general",
  "global-game",
  "java",
  "download",
  "account",
  "appearance",
  "about",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number] | "extension";

interface SettingsSidebarProps {
  activeCat: string;
  onNavigate: (cat: string) => void;
  query?: string;
  onQueryChange?: (query: string) => void;
  matchedCats?: string[] | null; // null = not searching
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeCat,
  onNavigate,
  query,
  onQueryChange,
  matchedCats = null,
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { newerVersion } = useLauncherConfig();

  return (
    <Flex direction="column" gap={3} w="100%" minH={0}>
      <Button
        variant="ghost"
        h="36px"
        px={2}
        justifyContent="flex-start"
        gap={2}
        color="muted"
        _hover={{ color: "ink" }}
        leftIcon={<LuChevronLeft />}
        onClick={() => router.back()}
      >
        {t("SettingsLayout.back")}
      </Button>
      {onQueryChange && (
        <Input
          h="36px"
          size="sm"
          placeholder={t("SettingsLayout.search.placeholder")}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            // first Escape clears the search
            if (e.key === "Escape" && query) {
              e.stopPropagation();
              onQueryChange("");
            }
          }}
        />
      )}
      <Flex direction="column" gap="2px" flex="1" minH={0} overflowY="auto">
        {SETTINGS_TABS.map((key) => {
          const hidden = matchedCats !== null && !matchedCats.includes(key);
          return (
            <Button
              key={key}
              variant="ghost"
              h="36px"
              px={3}
              justifyContent="flex-start"
              borderRadius="el-sm"
              fontSize="sm"
              fontWeight="500"
              color={activeCat === key ? "ink" : "muted"}
              bg={activeCat === key ? "surface" : "transparent"}
              _hover={{ color: "ink" }}
              display={hidden ? "none" : "flex"}
              onClick={() => onNavigate(key)}
            >
              {t(`SettingsLayout.settingsDomainList.${key}`)}
              {key === "about" && newerVersion.version && (
                <Badge bg="ink" color="onInk" borderRadius="el-pill" ml="auto">
                  {t("General.new")}
                </Badge>
              )}
            </Button>
          );
        })}
        <Box h={2} flexShrink={0} />
        <Button
          variant="ghost"
          h="36px"
          px={3}
          justifyContent="flex-start"
          borderRadius="el-sm"
          fontSize="sm"
          fontWeight="500"
          color={activeCat === "extension" ? "ink" : "muted"}
          bg={activeCat === "extension" ? "surface" : "transparent"}
          _hover={{ color: "ink" }}
          onClick={() => onNavigate("extension")}
        >
          {t("SettingsLayout.settingsDomainList.extension")}
        </Button>
      </Flex>
    </Flex>
  );
};

export default SettingsSidebar;

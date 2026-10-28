import { Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import PlayerAvatar from "@/components/player-avatar";
import AboutSettingsPage from "@/components/settings/sections/about-section";
import AppearanceSettingsPage from "@/components/settings/sections/appearance-section";
import DownloadSettingsPage from "@/components/settings/sections/download-section";
import GeneralSettingsPage from "@/components/settings/sections/general-section";
import GlobalGameSettingsPage from "@/components/settings/sections/global-game-section";
import HelpSettingsPage from "@/components/settings/sections/help-section";
import JavaSettingsPage from "@/components/settings/sections/java-section";
import SettingsSidebar, {
  SETTINGS_TABS,
} from "@/components/settings/settings-sidebar";
import { useGlobalData } from "@/contexts/global-data";
import { PlayerType } from "@/enums/account";

// easy-launcher settings — a single page (docs/design/DESIGN-settings.md):
// 240px sidebar (back, search, category tabs) + 900px content column.
// All sections stay mounted; the active tab (or the search filter) decides
// visibility via one DOM pass, so async-loaded rows are covered too.

const SettingsPage = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<string>("general");
  const [query, setQuery] = useState<string>("");
  const [noResults, setNoResults] = useState<boolean>(false);
  const [matchedCats, setMatchedCats] = useState<string[] | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // external links land as /settings?cat=<key>
  useEffect(() => {
    const cat = router.query.cat;
    if (
      typeof cat === "string" &&
      (SETTINGS_TABS as readonly string[]).includes(cat)
    ) {
      setActiveTab(cat);
    }
  }, [router.query.cat]);

  // one DOM pass: rows / groups / sections visibility for tab or search
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const run = () => {
      const q = query.trim().toLowerCase();
      let anyVisible = false;
      const matched: string[] = [];
      root
        .querySelectorAll<HTMLElement>("[data-settings-section]")
        .forEach((section) => {
          let sectionVisible = false;
          section
            .querySelectorAll<HTMLElement>("[data-settings-group]")
            .forEach((group) => {
              let groupVisible = false;
              group
                .querySelectorAll<HTMLElement>(".settings-row")
                .forEach((row) => {
                  const match =
                    !q || (row.textContent || "").toLowerCase().includes(q);
                  row.style.display = match ? "" : "none";
                  if (match) {
                    groupVisible = true;
                    sectionVisible = true;
                  }
                });
              // stray dividers between hidden rows would float alone
              group
                .querySelectorAll<HTMLElement>(".chakra-divider")
                .forEach((divider) => {
                  divider.style.display = q ? "none" : "";
                });
              group.style.display = groupVisible || !q ? "" : "none";
            });
          const active = section.dataset.settingsSection === activeTab;
          section.style.display = (q ? sectionVisible : active) ? "" : "none";
          if (sectionVisible) {
            anyVisible = true;
            matched.push(section.dataset.settingsSection || "");
          }
        });
      setNoResults(!!q && !anyVisible);
      setMatchedCats(q ? matched : null);
    };
    run();
    // async-loaded rows (java list, directories, ...) appear after mount
    const observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [query, activeTab]);

  return (
    <Flex h="100%" align="stretch">
      <Flex
        direction="column"
        as="nav"
        w="240px"
        flexShrink={0}
        className="content-full-y"
        borderRight="1px solid"
        borderColor="line"
        p={3}
        pt={4}
      >
        <SettingsSidebar
          activeCat={activeTab}
          onNavigate={(cat) => {
            setActiveTab(cat);
            setQuery("");
          }}
          query={query}
          onQueryChange={setQuery}
          matchedCats={matchedCats}
        />
      </Flex>
      <Box
        ref={contentRef}
        className="content-full-y"
        flex="1"
        minW={0}
        pt={2}
        px="40px"
        pb="40px"
      >
        <Box
          data-settings-section="general"
          maxW="900px"
          mx="auto"
          style={{ display: "none" }}
        >
          <Text as="h2" fontSize="20px" fontWeight="600" pt="20px" pb="8px">
            {t("SettingsLayout.settingsDomainList.general")}
          </Text>
          <GeneralSettingsPage />
        </Box>
        <Box
          data-settings-section="global-game"
          maxW="900px"
          mx="auto"
          style={{ display: "none" }}
        >
          <Text as="h2" fontSize="20px" fontWeight="600" pt="20px" pb="8px">
            {t("SettingsLayout.settingsDomainList.global-game")}
          </Text>
          <GlobalGameSettingsPage />
        </Box>
        <Box
          data-settings-section="java"
          maxW="900px"
          mx="auto"
          style={{ display: "none" }}
        >
          <Text as="h2" fontSize="20px" fontWeight="600" pt="20px" pb="8px">
            {t("SettingsLayout.settingsDomainList.java")}
          </Text>
          <JavaSettingsPage />
        </Box>
        <Box
          data-settings-section="download"
          maxW="900px"
          mx="auto"
          style={{ display: "none" }}
        >
          <Text as="h2" fontSize="20px" fontWeight="600" pt="20px" pb="8px">
            {t("SettingsLayout.settingsDomainList.download")}
          </Text>
          <DownloadSettingsPage />
        </Box>
        <Box
          data-settings-section="account"
          maxW="900px"
          mx="auto"
          style={{ display: "none" }}
        >
          <Text as="h2" fontSize="20px" fontWeight="600" pt="20px" pb="8px">
            {t("SettingsLayout.settingsDomainList.account")}
          </Text>
          <AccountSection />
        </Box>
        <Box
          data-settings-section="appearance"
          maxW="900px"
          mx="auto"
          style={{ display: "none" }}
        >
          <Text as="h2" fontSize="20px" fontWeight="600" pt="20px" pb="8px">
            {t("SettingsLayout.settingsDomainList.appearance")}
          </Text>
          <AppearanceSettingsPage />
        </Box>
        <Box
          data-settings-section="about"
          maxW="900px"
          mx="auto"
          style={{ display: "none" }}
        >
          <Text as="h2" fontSize="20px" fontWeight="600" pt="20px" pb="8px">
            {t("SettingsLayout.settingsDomainList.about")}
          </Text>
          <AboutSettingsPage />
          <HelpSettingsPage />
        </Box>
        <Text color="muted" pt={8} display={noResults ? "block" : "none"}>
          {t("SettingsLayout.search.empty")}
        </Text>
      </Box>
    </Flex>
  );
};

// mini account row (docs/design/DESIGN-account.md) — full account management
// lives on /accounts.
const AccountSection = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedPlayer } = useGlobalData();
  const player = selectedPlayer;

  return (
    <HStack
      className="settings-row"
      minH="64px"
      py="10px"
      gap={3}
      justify="space-between"
    >
      <HStack gap={3} minW={0}>
        <PlayerAvatar
          avatar={player?.avatar || []}
          boxSize="40px"
          borderRadius="el-sm"
          objectFit="cover"
          flexShrink={0}
        />
        <Box minW={0}>
          <Text fontWeight="600" className="ellipsis-text">
            {player?.name || "-"}
          </Text>
          <Text fontSize="sm" color="muted" className="ellipsis-text">
            {player
              ? player.playerType === PlayerType.Offline
                ? t("Enums.playerTypes.offline")
                : `${t("Enums.playerTypes.3rdpartyShort")}${
                    player.authServer?.name
                      ? ` - ${player.authServer.name}`
                      : ""
                  }`
              : t("AccountsPage.addForm.empty")}
          </Text>
        </Box>
      </HStack>
      <Button
        size="sm"
        variant="ghost"
        flexShrink={0}
        onClick={() => router.push("/accounts")}
      >
        {t("SettingsLayout.button.manageAccount")}
      </Button>
    </HStack>
  );
};

export default SettingsPage;

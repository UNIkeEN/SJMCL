import { Box, Flex } from "@chakra-ui/react";
import { useRouter } from "next/router";
import React from "react";
import SettingsSidebar, {
  SETTINGS_TABS,
} from "@/components/settings/settings-sidebar";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

const SettingsLayout: React.FC<SettingsLayoutProps> = ({ children }) => {
  const router = useRouter();

  // The single settings page (/settings) brings its own sidebar.
  // This layout only wraps the leftover special routes:
  // /settings/extension/* and /settings/download/ping-test.
  if (router.pathname === "/settings") {
    return <>{children}</>;
  }

  const selectedKey = SETTINGS_TABS.find((key) =>
    router.pathname.startsWith(`/settings/${key}`)
  );

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
          activeCat={
            router.pathname.startsWith("/settings/extension")
              ? "extension"
              : selectedKey || ""
          }
          onNavigate={(cat) =>
            cat === "extension"
              ? router.push("/settings/extension")
              : router.push({ pathname: "/settings", query: { cat } })
          }
        />
      </Flex>
      <Box flex={1} minW={0} className="content-full-y" key={router.asPath}>
        {children}
      </Box>
    </Flex>
  );
};

export default SettingsLayout;

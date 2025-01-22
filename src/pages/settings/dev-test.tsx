import { Alert, AlertIcon, Button, VStack } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import SkinPreview from "@/components/common/skin-preview";
import { isProd } from "@/utils/env";
import { createWindow } from "@/utils/window";

// ============================================================
// This page is only for developers to test components, etc.
// DO NOT commit changes to this page.
// ============================================================

const DevTestPage = () => {
  const router = useRouter();
  useEffect(() => {
    if (isProd) {
      router.push("/launch");
    }
  }, [router]);

  return (
    <VStack align="start" spacing={4}>
      <Alert status="warning" fontSize="sm" variant="left-accent">
        <AlertIcon />
        This Page is only for developer to test components and etc. It will not
        shown in production mode.
      </Alert>

      {/* Use this button to navigate to pages awaiting testing but not directly accessible (e.g. game-log) */}
      <Button
        onClick={() => {
          createWindow("", "/standalone/game-log", {
            title: "Game Log",
            minWidth: 640,
            minHeight: 440,
          });
        }}
      >
        Create New Window
      </Button>

      {/* Add test components here */}
      <SkinPreview />
    </VStack>
  );
};

export default DevTestPage;

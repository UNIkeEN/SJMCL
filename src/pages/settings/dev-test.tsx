import { Alert, AlertIcon, Button, VStack } from "@chakra-ui/react";
import { invoke } from "@tauri-apps/api/core";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import DownloadResourceModal from "@/components/modals/download-resource-modal";
import SkinPreview from "@/components/skin-preview";
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

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

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
          createWindow("", "/standalone/game-error", {
            title: "Game Error",
            minWidth: 640,
            minHeight: 440,
          });
        }}
      >
        Create New Window
      </Button>

      <Button onClick={() => setIsModalOpen(true)}>
        Download Resource Modal
      </Button>
      <DownloadResourceModal
        initialResourceType="shaderpack"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <Button
        onClick={async () => {
          try {
            await invoke("launch_game", { instanceId: 2 });
          } catch (error) {
            console.error("Error invoking launch_game:", error);
            alert(
              "An error occurred while launching the game. Please try again."
            );
          }
        }}
      >
        Launch Game
      </Button>
      {/* Add test components here */}
      <SkinPreview />
    </VStack>
  );
};

export default DevTestPage;

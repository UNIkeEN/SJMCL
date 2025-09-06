import { Alert, AlertIcon, Button, VStack } from "@chakra-ui/react";
import { invoke } from "@tauri-apps/api/core";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import SkinPreview from "@/components/skin-preview";
import { useTaskContext } from "@/contexts/task";
import {
  DownloadRuntimeTaskParam,
  RuntimeTaskParam,
  TaskTypeEnums,
} from "@/models/task";
import { isProd } from "@/utils/env";
import { createWindow } from "@/utils/window";

// ============================================================
// This page is only for developers to test components, etc.
// DO NOT commit changes to this page.
// ============================================================

const DevTestPage = () => {
  const { handleScheduleProgressiveTaskGroup } = useTaskContext();
  const router = useRouter();
  useEffect(() => {
    if (isProd) {
      router.push("/launch");
    }
  }, [router]);

  const [task_id, setTaskId] = useState<number | null>(null);

  return (
    <VStack align="start" spacing={4}>
      <Alert status="warning" fontSize="xs-sm" borderRadius="md">
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

      <Button
        onClick={async () => {
          try {
            await invoke("launch_game", { instanceId: 4 });
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
      <Button
        onClick={() => {
          console.log("Download button clicked");
          let dl: DownloadRuntimeTaskParam[] = [
            {
              src: "https://edge.forgecdn.net/files/3045/381/%5B___MixinCompat-0.8___%5D.jar",
              dest: "D:\\mods\\[___MixinCompat-0.8___].jar",
              type: TaskTypeEnums.Download,
            },
          ];
          handleScheduleProgressiveTaskGroup(
            "group1",
            dl as RuntimeTaskParam[]
          );
        }}
      >
        Start Downloading Task
      </Button>
      <Button>Transient task</Button>

      {/* Add test components here */}
      <SkinPreview />
    </VStack>
  );
};

export default DevTestPage;

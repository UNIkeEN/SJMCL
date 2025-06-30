import { Alert, AlertIcon, Button, VStack } from "@chakra-ui/react";
import { invoke } from "@tauri-apps/api/core";
import { Event, listen } from "@tauri-apps/api/event";
import { info } from "@tauri-apps/plugin-log";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import DownloadResourceModal from "@/components/modals/download-resource-modal";
import SkinPreview from "@/components/skin-preview";
import { DownloadTaskParam, TaskParam, TaskTypeEnums } from "@/models/task";
import { PTaskEventPayload } from "@/models/task";
import { TaskService } from "@/services/task";
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
  const [task_id, setTaskId] = useState<number | null>(null);

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
          let dl: DownloadTaskParam[] = [
            {
              src: "https://piston-data.mojang.com/v1/objects/15c777e2cfe0556eef19aab534b186c0c6f277e1/server.jar",
              dest: "1.jar",
              sha1: "15c777e2cfe0556eef19aab534b186c0c6f277e1",
              task_type: TaskTypeEnums.Download,
            },
            {
              src: "https://piston-data.mojang.com/v1/objects/15c777e2cfe0556eef19aab534b186c0c6f277e1/server.jar",
              dest: "2.jar",
              sha1: "15c777e2cfe0556eef19aab534b186c0c6f277e1",
              task_type: TaskTypeEnums.Download,
            },
          ];
          TaskService.scheduleProgressiveTaskGroup(
            "group1",
            dl as TaskParam[]
          ).then((response) => {
            info(JSON.stringify(response));
            if (response.status == "success") {
              listen(
                `group1`,
                (event: Event<PTaskEventPayload>) => {
                  if (event.payload.event.state == "InProgress") {
                    info(event.payload.event.current.toString());
                  }
                  info(JSON.stringify(event));
                },
                {
                  target: `SJMCL://task-progress`,
                }
              ).then((unlisten) => {});
            }
          });
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

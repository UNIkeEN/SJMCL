import {
  Flex,
  HStack,
  IconButton,
  Progress,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronRight, LuSettings } from "react-icons/lu";
import {
  LuChevronDown,
  LuPause,
  LuPlay,
  LuRotateCcw,
  LuX,
} from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { useTaskContext } from "@/contexts/task";
import { TaskDesc, TaskDescStateEnums } from "@/models/task";
import { formatTimeInterval } from "@/utils/datetime";
import { formatByteSize } from "@/utils/string";

export const DownloadTasksPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const { getTasks, handleScheduleProgressiveTaskGroup } = useTaskContext();
  const [tasks, setTasks] = useState<[TaskDesc, boolean][]>([]); // boolean is used to record accordion state.

  useEffect(() => {
    const list = getTasks(true) || [];
    const enhanced = list.map((task) => {
      return [
        {
          ...task,
          progress: task.total > 0 ? (task.current / task.total) * 100 : 0,
          isDownloading: task.state === TaskDescStateEnums.InProgress,
          isWaiting: task.state === TaskDescStateEnums.Stopped,
          isError: task.state === TaskDescStateEnums.Failed,
          isCancelled: task.state === TaskDescStateEnums.Cancelled,
        },
        true,
      ] as [TaskDesc, boolean];
    });
    setTasks(enhanced);
  }, [getTasks]);

  const toggleTaskExpansion = (id: number) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task[0].taskId === id ? [task[0], !task[1]] : task
      )
    );
  };

  return (
    <Section
      className="content-full-y"
      title={t("DownloadTasksPage.title")}
      withBackButton
      headExtra={
        <CommonIconButton
          icon={LuSettings}
          label={t("DownloadTasksPage.button.settings")}
          onClick={() => {
            router.push("/settings/download");
          }}
          size="xs"
          fontSize="sm"
          h={21}
        />
      }
    >
      <VStack align="stretch" px="10%" spacing={4}>
        {tasks.map(([task, expanded]) => (
          <OptionItemGroup
            key={task.taskId}
            items={[
              <VStack align="stretch" key={task.taskId}>
                <Flex justify="space-between" alignItems="center">
                  <Text fontSize="xs-sm" fontWeight="bold">
                    {task.taskGroup}
                  </Text>

                  <HStack alignItems="center">
                    {task.isDownloading && !task.isError && !task.isWaiting && (
                      <Text fontSize="xs" className="secondary-text">
                        {`${formatByteSize(0)}/s, ${formatTimeInterval(0)}`}
                      </Text>
                    )}

                    {task.isWaiting && (
                      <Text fontSize="xs" className="secondary-text">
                        {t("DownloadTasksPage.label.paused")}
                      </Text>
                    )}

                    {task.isError && (
                      <Text fontSize="xs" color="red.600">
                        {task.reason || t("DownloadTasksPage.label.error")}
                      </Text>
                    )}

                    {!task.isError && (
                      <Tooltip
                        label={t(
                          `DownloadTasksPage.button.${
                            task.isDownloading ? "pause" : "begin"
                          }`
                        )}
                      >
                        <IconButton
                          aria-label="pause / download"
                          icon={task.isDownloading ? <LuPause /> : <LuPlay />}
                          size="xs"
                          fontSize="sm"
                          h={21}
                          ml={1}
                          variant="ghost"
                          onClick={() => {}}
                        />
                      </Tooltip>
                    )}

                    {task.isError && (
                      <Tooltip label={t("DownloadTasksPage.button.retry")}>
                        <IconButton
                          aria-label="retry"
                          icon={<LuRotateCcw />}
                          size="xs"
                          fontSize="sm"
                          h={21}
                          ml={1}
                          variant="ghost"
                          onClick={() =>
                            handleScheduleProgressiveTaskGroup(
                              task.taskGroup || "",
                              [task.payload]
                            )
                          }
                        />
                      </Tooltip>
                    )}

                    <Tooltip label={t("General.cancel")}>
                      <IconButton
                        aria-label="cancel"
                        icon={<LuX />}
                        size="xs"
                        fontSize="sm"
                        h={21}
                        variant="ghost"
                        onClick={() => {}}
                      />
                    </Tooltip>

                    <IconButton
                      aria-label="toggle expansion"
                      icon={expanded ? <LuChevronDown /> : <LuChevronRight />}
                      size="xs"
                      fontSize="sm"
                      h={21}
                      variant="ghost"
                      onClick={() => toggleTaskExpansion(task.taskId)}
                    />
                  </HStack>
                </Flex>

                <Progress
                  value={task.progress}
                  colorScheme={primaryColor}
                  borderRadius="sm"
                />
              </VStack>,

              ...(expanded
                ? [
                    <OptionItem
                      key={`${task.taskId}-detail`}
                      title={`${task.payload.dest}`}
                      titleExtra={
                        task.isDownloading && (
                          <Text
                            fontSize="xs"
                            className="secondary-text"
                            mt={0.5}
                          >
                            {`${formatByteSize(task.current)} / ${formatByteSize(
                              task.total
                            )}`}
                          </Text>
                        )
                      }
                    >
                      <Progress
                        w={36}
                        size="sm"
                        value={task.progress}
                        colorScheme={primaryColor}
                        borderRadius="sm"
                      />
                    </OptionItem>,
                  ]
                : []),
            ]}
            maxFirstVisibleItems={4}
          />
        ))}
      </VStack>
    </Section>
  );
};

export default DownloadTasksPage;

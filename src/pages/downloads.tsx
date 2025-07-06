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
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { useLauncherConfig } from "@/contexts/config";
import { useTaskContext } from "@/contexts/task";
import { TaskDesc, TaskDescStatusEnums } from "@/models/task";
import { formatTimeInterval } from "@/utils/datetime";
import { extractFileName, formatByteSize } from "@/utils/string";

export const DownloadTasksPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const {
    tasks,
    handleScheduleProgressiveTaskGroup,
    handleCancelProgressiveTask,
    handleStopProgressiveTask,
    handleResumeProgressiveTask,
  } = useTaskContext();

  const [taskList, setTaskList] = useState<[TaskDesc, boolean][]>([]); // boolean is used to record accordion state.

  useEffect(() => {
    setTaskList((prev) => {
      return tasks.map((task) => {
        return [
          {
            ...task,
            progress: task.total > 0 ? (task.current / task.total) * 100 : 0,
            isDownloading: task.status === TaskDescStatusEnums.InProgress,
            isWaiting: task.status === TaskDescStatusEnums.Stopped,
            isFailed:
              task.status === TaskDescStatusEnums.Failed || !!task.reason,
            isCancelled: task.status === TaskDescStatusEnums.Cancelled,
          },
          prev.find((t) => t[0].taskId === task.taskId)?.[1] ?? true,
        ] as [TaskDesc, boolean];
      });
    });
  }, [tasks, setTaskList]);

  const toggleTaskExpansion = (id: number) => {
    setTaskList((prevTasks) =>
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
        {taskList.length === 0 && <Empty withIcon={false} size="sm" />}
        {taskList.map(([task, expanded]) => (
          <OptionItemGroup
            key={task.taskId}
            items={[
              <VStack align="stretch" key={task.taskId}>
                <Flex justify="space-between" alignItems="center">
                  <Text fontSize="xs-sm" fontWeight="bold">
                    {task.taskGroup}
                  </Text>

                  <HStack alignItems="center">
                    {task.isDownloading &&
                      task.estimatedTime &&
                      !task.isFailed &&
                      !task.isWaiting && (
                        <Text fontSize="xs" className="secondary-text">
                          {`${formatTimeInterval(task.estimatedTime.secs)}`}
                        </Text>
                      )}

                    {task.isWaiting && (
                      <Text fontSize="xs" className="secondary-text">
                        {t("DownloadTasksPage.label.paused")}
                      </Text>
                    )}

                    {task.isFailed && (
                      <Text fontSize="xs" color="red.600">
                        {task.reason || t("DownloadTasksPage.label.error")}
                      </Text>
                    )}

                    {task.isCancelled && (
                      <Text fontSize="xs" color="red.600">
                        {t("DownloadTasksPage.label.cancelled")}
                      </Text>
                    )}

                    {!task.isFailed && !task.isCancelled && (
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
                          onClick={() => {
                            task.isDownloading
                              ? handleStopProgressiveTask(task.taskId)
                              : handleResumeProgressiveTask(task.taskId);
                          }}
                        />
                      </Tooltip>
                    )}

                    {task.isFailed && (
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

                    {!task.isCancelled && (
                      <Tooltip label={t("General.cancel")}>
                        <IconButton
                          aria-label="cancel"
                          icon={<LuX />}
                          size="xs"
                          fontSize="sm"
                          h={21}
                          variant="ghost"
                          onClick={() =>
                            handleCancelProgressiveTask(task.taskId)
                          }
                        />
                      </Tooltip>
                    )}

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
                      title={extractFileName(task.payload.dest, true)}
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

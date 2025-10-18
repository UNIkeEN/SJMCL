import {
  Flex,
  HStack,
  IconButton,
  Progress,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
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
import { parseTaskGroup, useTaskContext } from "@/contexts/task";
import {
  GTaskEventStatusEnums,
  TaskDesc,
  TaskDescStatusEnums,
  TaskGroupDesc,
} from "@/models/task";
import { formatTimeInterval } from "@/utils/datetime";
import { formatByteSize } from "@/utils/string";

export const DownloadTasksPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const {
    tasks,
    handleScheduleProgressiveTaskGroup,
    handleCancelProgressiveTaskGroup,
    handleStopProgressiveTaskGroup,
    handleResumeProgressiveTaskGroup,
  } = useTaskContext();

  const [taskGroupList, setTaskGroupList] = useState<
    [TaskGroupDesc, boolean][]
  >([]); // boolean is used to record accordion state.

  useEffect(() => {
    setTaskGroupList((prev) => {
      return tasks.map((task) => {
        return [
          task,
          prev.find((t) => t[0].taskGroup === task.taskGroup)?.[1] ?? true,
        ] as [TaskGroupDesc, boolean];
      });
    });
  }, [tasks, setTaskGroupList]);

  const toggleTaskExpansion = (taskGroup: string) => {
    setTaskGroupList((prevGroups) =>
      prevGroups.map((group) =>
        group[0].taskGroup === taskGroup ? [group[0], !group[1]] : group
      )
    );
  };

  const showTaskProgressInfo = (task: TaskDesc) => {
    let text = [];
    if (task.total) {
      text.push(
        `${formatByteSize(task.current)} / ${formatByteSize(task.total)}`
      );
    }
    if (task.speed) {
      text.push(`${formatByteSize(task.speed)}/s`);
    }
    return text.join(" - ");
  };

  const parseGroupTitle = (taskGroup: string) => {
    let { name, version, isRetry } = parseTaskGroup(taskGroup);

    return `${isRetry ? `${t(`DownloadTasksPage.task.retry`)} ` : ""}${t(
      `DownloadTasksPage.task.${name}`,
      {
        param: version || "",
      }
    )}`;
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
        {taskGroupList.length === 0 && <Empty withIcon={false} size="sm" />}
        {taskGroupList.map(([group, expanded]) => (
          <OptionItemGroup
            key={group.taskGroup}
            items={[
              <VStack align="stretch" key={group.taskGroup}>
                <Flex justify="space-between" alignItems="center">
                  <Text fontSize="xs-sm" fontWeight="bold">
                    {parseGroupTitle(group.taskGroup)}
                  </Text>

                  <HStack alignItems="center">
                    <Text fontSize="xs" className="secondary-text">
                      {group.finishedCount} / {group.taskDescs.length}
                    </Text>
                    {group.status === GTaskEventStatusEnums.Started &&
                      group.estimatedTime && (
                        <Text fontSize="xs" className="secondary-text">
                          {formatTimeInterval(group.estimatedTime.secs)}
                        </Text>
                      )}

                    {group.status === GTaskEventStatusEnums.Stopped && (
                      <Text fontSize="xs" className="secondary-text">
                        {t("DownloadTasksPage.label.paused")}
                      </Text>
                    )}

                    {group.status === GTaskEventStatusEnums.Completed && (
                      <Text fontSize="xs" className="secondary-text">
                        {t("DownloadTasksPage.label.completed")}
                      </Text>
                    )}

                    {(group.status === GTaskEventStatusEnums.Failed ||
                      group.reason) && (
                      <Text fontSize="xs" color="red.600">
                        {group.reason || t("DownloadTasksPage.label.error")}
                      </Text>
                    )}

                    {group.status === GTaskEventStatusEnums.Cancelled && (
                      <Text fontSize="xs" color="red.600">
                        {t("DownloadTasksPage.label.cancelled")}
                      </Text>
                    )}

                    {(group.status === GTaskEventStatusEnums.Stopped ||
                      group.status === GTaskEventStatusEnums.Started) && (
                      <Tooltip
                        label={t(
                          `DownloadTasksPage.button.${
                            group.status === GTaskEventStatusEnums.Started
                              ? "pause"
                              : "begin"
                          }`
                        )}
                      >
                        <IconButton
                          aria-label="pause / download"
                          icon={
                            group.status === GTaskEventStatusEnums.Started ? (
                              <LuPause />
                            ) : (
                              <LuPlay />
                            )
                          }
                          size="xs"
                          fontSize="sm"
                          h={21}
                          ml={1}
                          variant="ghost"
                          onClick={() => {
                            group.status === GTaskEventStatusEnums.Started
                              ? handleStopProgressiveTaskGroup(group.taskGroup)
                              : handleResumeProgressiveTaskGroup(
                                  group.taskGroup
                                );
                          }}
                        />
                      </Tooltip>
                    )}

                    {(group.status === GTaskEventStatusEnums.Failed ||
                      group.status === GTaskEventStatusEnums.Cancelled) && (
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
                              "retry-" +
                                parseTaskGroup(group.taskGroup).rawName.replace(
                                  /^retry-/,
                                  ""
                                ),
                              group.taskDescs
                                .filter(
                                  (t) =>
                                    t.status !== TaskDescStatusEnums.Completed
                                )
                                .map((t) => t.payload)
                            )
                          }
                        />
                      </Tooltip>
                    )}

                    {group.status !== GTaskEventStatusEnums.Cancelled &&
                      group.status !== GTaskEventStatusEnums.Completed && (
                        <Tooltip label={t("General.cancel")}>
                          <IconButton
                            aria-label="cancel"
                            icon={<LuX />}
                            size="xs"
                            fontSize="sm"
                            h={21}
                            variant="ghost"
                            onClick={() =>
                              handleCancelProgressiveTaskGroup(group.taskGroup)
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
                      onClick={() => toggleTaskExpansion(group.taskGroup)}
                    />
                  </HStack>
                </Flex>

                {group.status !== GTaskEventStatusEnums.Completed && (
                  <Progress
                    size="xs"
                    value={group.progress}
                    colorScheme={primaryColor}
                    borderRadius="sm"
                    mb={1}
                  />
                )}
              </VStack>,

              ...(expanded
                ? group.taskDescs.map((task) => (
                    <OptionItem
                      key={`${task.taskId}-detail`}
                      title={task.payload.filename}
                      description={
                        task.status === TaskDescStatusEnums.InProgress && (
                          <Text
                            fontSize="xs"
                            className="secondary-text"
                            mt={0.5}
                          >
                            {showTaskProgressInfo(task)}
                          </Text>
                        )
                      }
                    >
                      {task.status !== TaskDescStatusEnums.Completed &&
                        task.status !== TaskDescStatusEnums.Failed && (
                          <Progress
                            w={36}
                            size="xs"
                            value={task.progress}
                            colorScheme={primaryColor}
                            isIndeterminate={
                              task.status === TaskDescStatusEnums.Waiting
                            }
                            borderRadius="sm"
                          />
                        )}
                      {task.status === TaskDescStatusEnums.Failed && (
                        <Tooltip label={task.reason}>
                          <Text color="red.600" fontSize="xs">
                            {t("DownloadTasksPage.label.error")}
                          </Text>
                        </Tooltip>
                      )}
                      {task.status === TaskDescStatusEnums.Completed && (
                        <CommonIconButton
                          icon="revealFile"
                          size="xs"
                          fontSize="sm"
                          h={21}
                          onClick={() => revealItemInDir(task.payload.dest)}
                        />
                      )}
                    </OptionItem>
                  ))
                : []),
            ]}
            maxFirstVisibleItems={6}
            enableShowAll={false}
          />
        ))}
      </VStack>
    </Section>
  );
};

export default DownloadTasksPage;

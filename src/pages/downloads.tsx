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
import { LuChevronRight, LuSettings, LuTrash2 } from "react-icons/lu";
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
  DownloadFinishKind,
  DownloadGroup,
  DownloadGroupState,
  DownloadTask,
  DownloadTaskState,
} from "@/models/download";
import { formatTimeInterval } from "@/utils/datetime";
import { formatByteSize } from "@/utils/string";

export const DownloadTasksPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const {
    tasks,
    handleCancelDownloadGroup,
    handlePauseDownloadGroup,
    handleResumeDownloadGroup,
    handleRetryDownloadGroup,
    handleClearDownloadHistory,
  } = useTaskContext();
  const [taskGroupList, setTaskGroupList] = useState<
    [DownloadGroup, boolean][]
  >([]);

  useEffect(() => {
    setTaskGroupList((previous) =>
      tasks.map((task) => [
        task,
        previous.find(([group]) => group.id === task.id)?.[1] ?? true,
      ])
    );
  }, [tasks]);

  const toggleTaskExpansion = (groupId: string) => {
    setTaskGroupList((groups) =>
      groups.map(([group, expanded]) =>
        group.id === groupId ? [group, !expanded] : [group, expanded]
      )
    );
  };

  const showTaskProgressInfo = (task: DownloadTask) => {
    const parts = [];
    if (task.total) {
      parts.push(
        `${formatByteSize(task.received)} / ${formatByteSize(task.total)}`
      );
    }
    if (task.speedBps) parts.push(`${formatByteSize(task.speedBps)}/s`);
    return parts.join(" - ");
  };

  const parseGroupTitle = (name: string) => {
    const parsed = parseTaskGroup(name);
    return t(`DownloadTasksPage.task.${parsed.name}`, parsed.params);
  };

  return (
    <Section
      className="content-full-y"
      title={t("DownloadTasksPage.title")}
      withBackButton
      headExtra={
        <HStack>
          <CommonIconButton
            icon={LuTrash2}
            label={t("DownloadTasksPage.button.clearHistory")}
            onClick={handleClearDownloadHistory}
            isDisabled={
              !tasks.some(
                (group) => group.state === DownloadGroupState.Finished
              )
            }
            size="xs"
            fontSize="sm"
            h={21}
          />
          <CommonIconButton
            icon={LuSettings}
            label={t("DownloadTasksPage.button.settings")}
            onClick={() => router.push("/settings/download")}
            size="xs"
            fontSize="sm"
            h={21}
          />
        </HStack>
      }
    >
      <VStack align="stretch" px="10%" spacing={4}>
        {taskGroupList.length === 0 && <Empty withIcon={false} size="sm" />}
        {taskGroupList.map(([group, expanded]) => (
          <OptionItemGroup
            key={group.id}
            items={[
              <VStack align="stretch" key={group.id}>
                <Flex justify="space-between" alignItems="center">
                  <Text fontSize="xs-sm" fontWeight="bold">
                    {parseGroupTitle(group.name)}
                  </Text>
                  <HStack alignItems="center">
                    <Text fontSize="xs" className="secondary-text">
                      {group.stats.done} / {group.tasks.length}
                    </Text>
                    {group.state === DownloadGroupState.Active &&
                      group.etaSecs != null && (
                        <Text fontSize="xs" className="secondary-text">
                          {formatTimeInterval(group.etaSecs)}
                        </Text>
                      )}
                    {group.state === DownloadGroupState.Paused && (
                      <Text fontSize="xs" className="secondary-text">
                        {t("DownloadTasksPage.label.paused")}
                      </Text>
                    )}
                    {group.finish === DownloadFinishKind.Completed && (
                      <Text fontSize="xs" className="secondary-text">
                        {t("DownloadTasksPage.label.completed")}
                      </Text>
                    )}
                    {group.finish === DownloadFinishKind.Failed && (
                      <Text fontSize="xs" color="red.600">
                        {group.error || t("DownloadTasksPage.label.error")}
                      </Text>
                    )}
                    {group.finish === DownloadFinishKind.Cancelled && (
                      <Text fontSize="xs" color="red.600">
                        {t("DownloadTasksPage.label.cancelled")}
                      </Text>
                    )}
                    {(group.state === DownloadGroupState.Active ||
                      group.state === DownloadGroupState.Queued ||
                      group.state === DownloadGroupState.Paused) && (
                      <Tooltip
                        label={t(
                          `DownloadTasksPage.button.${
                            group.state === DownloadGroupState.Paused
                              ? "begin"
                              : "pause"
                          }`
                        )}
                      >
                        <IconButton
                          aria-label="pause / download"
                          icon={
                            group.state === DownloadGroupState.Paused ? (
                              <LuPlay />
                            ) : (
                              <LuPause />
                            )
                          }
                          size="xs"
                          fontSize="sm"
                          h={21}
                          ml={1}
                          variant="ghost"
                          onClick={() =>
                            group.state === DownloadGroupState.Paused
                              ? handleResumeDownloadGroup(group.id)
                              : handlePauseDownloadGroup(group.id)
                          }
                        />
                      </Tooltip>
                    )}
                    {group.finish === DownloadFinishKind.Failed && (
                      <Tooltip label={t("DownloadTasksPage.button.retry")}>
                        <IconButton
                          aria-label="retry"
                          icon={<LuRotateCcw />}
                          size="xs"
                          fontSize="sm"
                          h={21}
                          ml={1}
                          variant="ghost"
                          onClick={() => handleRetryDownloadGroup(group.id)}
                        />
                      </Tooltip>
                    )}
                    {group.state !== DownloadGroupState.Finished && (
                      <Tooltip label={t("General.cancel")}>
                        <IconButton
                          aria-label="cancel"
                          icon={<LuX />}
                          size="xs"
                          fontSize="sm"
                          h={21}
                          variant="ghost"
                          onClick={() => handleCancelDownloadGroup(group.id)}
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
                      onClick={() => toggleTaskExpansion(group.id)}
                    />
                  </HStack>
                </Flex>
                {group.finish !== DownloadFinishKind.Completed && (
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
                ? group.tasks.map((task) => (
                    <OptionItem
                      key={`${task.id}-detail`}
                      title={task.name}
                      description={
                        (task.state === DownloadTaskState.Downloading ||
                          task.state === DownloadTaskState.Verifying) && (
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
                      {task.state !== DownloadTaskState.Done &&
                        task.state !== DownloadTaskState.Failed && (
                          <Progress
                            w={36}
                            size="xs"
                            value={task.progress}
                            colorScheme={primaryColor}
                            isIndeterminate={
                              task.state === DownloadTaskState.Pending
                            }
                            borderRadius="sm"
                          />
                        )}
                      {task.state === DownloadTaskState.Failed && (
                        <Tooltip label={JSON.stringify(task.error)}>
                          <Text color="red.600" fontSize="xs">
                            {t("DownloadTasksPage.label.error")}
                          </Text>
                        </Tooltip>
                      )}
                      {task.state === DownloadTaskState.Done && (
                        <CommonIconButton
                          icon="revealFile"
                          size="xs"
                          fontSize="sm"
                          h={21}
                          onClick={() => revealItemInDir(task.dest)}
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

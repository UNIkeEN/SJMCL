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
import { mockDownloadTasks } from "@/models/mock/task";
import { DownloadTask } from "@/models/task";
import { formatTimeInterval } from "@/utils/datetime";
import { formatByteSize } from "@/utils/string";

export const DownloadTasksPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [tasks, setTasks] = useState<[DownloadTask, boolean][]>([]); // boolean is used to record accordion state.

  // only for mock
  useEffect(() => {
    setTasks(mockDownloadTasks.map((task) => [task, true]));
  }, []);

  const toggleTaskExpansion = (id: number) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) => (task[0].id === id ? [task[0], !task[1]] : task))
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
        {tasks.map((task) => (
          <OptionItemGroup
            key={task[0].id}
            items={[
              <VStack align="stretch" key={task[0].id}>
                <Flex justify="space-between" alignItems="center">
                  <Text fontSize="xs-sm" fontWeight="bold">
                    {task[0].name}
                  </Text>
                  <HStack alignItems="center">
                    {task[0].isDownloading &&
                      !task[0].isError &&
                      !task[0].isWaiting && (
                        <Text fontSize="xs" className="secondary-text">
                          {`${formatByteSize(task[0].speed)}/s, ${formatTimeInterval(task[0].elapsedTime)}`}
                        </Text>
                      )}
                    {!task[0].isDownloading && !task[0].isError && (
                      <Text fontSize="xs" className="secondary-text">
                        {t("DownloadTasksPage.label.paused")}
                      </Text>
                    )}
                    {task[0].isError && (
                      <Text fontSize="xs" color="red.600">
                        {t("DownloadTasksPage.label.error")}
                      </Text>
                    )}

                    {!task[0].isError && (
                      <Tooltip
                        label={t(
                          `DownloadTasksPage.button.${task[0].isDownloading ? "pause" : "begin"}`
                        )}
                      >
                        <IconButton
                          aria-label="pause / download"
                          icon={
                            task[0].isDownloading ? <LuPause /> : <LuPlay />
                          }
                          size="xs"
                          fontSize="sm"
                          h={21}
                          ml={1}
                          variant="ghost"
                          onClick={() => {}}
                        />
                      </Tooltip>
                    )}
                    {task[0].isError && (
                      <Tooltip label={t("DownloadTasksPage.button.retry")}>
                        <IconButton
                          aria-label="retry"
                          icon={<LuRotateCcw />}
                          size="xs"
                          fontSize="sm"
                          h={21}
                          ml={1}
                          variant="ghost"
                          onClick={() => {}}
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
                      icon={task[1] ? <LuChevronDown /> : <LuChevronRight />}
                      size="xs"
                      fontSize="sm"
                      h={21}
                      variant="ghost"
                      onClick={() => toggleTaskExpansion(task[0].id)}
                    />
                  </HStack>
                </Flex>
                <Progress
                  value={task[0].progress}
                  colorScheme={primaryColor}
                  borderRadius="sm"
                />
              </VStack>,
              ...(task[1]
                ? [
                    ...task[0].items.map((item) => (
                      <OptionItem
                        key={item.src}
                        title={item.fileName || item.src}
                        titleExtra={
                          task[0].isDownloading &&
                          !item.isWaiting && (
                            <Text fontSize="xs" className="secondary-text">
                              {`${formatByteSize(item.finishedSize)} / ${formatByteSize(item.totalSize)}`}
                            </Text>
                          )
                        }
                      >
                        <HStack>
                          {task[0].isDownloading &&
                            !task[0].isError &&
                            !item.isWaiting && (
                              <Text fontSize="xs" className="secondary-text">
                                {`${formatByteSize(item.speed)}/s`}
                              </Text>
                            )}
                          <Progress
                            w={36}
                            size="sm"
                            value={(100 * item.finishedSize) / item.totalSize}
                            colorScheme={primaryColor}
                            borderRadius="sm"
                          />
                        </HStack>
                      </OptionItem>
                    )),
                  ]
                : []),
            ]}
          />
        ))}
      </VStack>
    </Section>
  );
};

export default DownloadTasksPage;

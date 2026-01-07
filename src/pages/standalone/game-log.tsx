import {
  Box,
  Button,
  Flex,
  IconButton,
  Input,
  Spacer,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { appLogDir, join } from "@tauri-apps/api/path";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronsDown, LuFileInput, LuTrash } from "react-icons/lu";
import Empty from "@/components/common/empty";
import { useLauncherConfig } from "@/contexts/config";
import { LaunchService } from "@/services/launch";
import styles from "@/styles/game-log.module.css";
import { parseIdFromWindowLabel } from "@/utils/window";

const GameLogPage: React.FC = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [logs, setLogs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStates, setFilterStates] = useState<{ [key: string]: boolean }>({
    FATAL: true,
    ERROR: true,
    WARN: true,
    INFO: true,
    DEBUG: true,
  });
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const launchingIdRef = useRef<number | null>(null);

  const clearLogs = () => setLogs([]);

  // set window title with i18n
  useEffect(() => {
    (async () => {
      await getCurrentWebviewWindow().setTitle(t("Tauri.windowTitle.gameLog"));
    })();
  }, [t]);

  // invoke retrieve on first load
  useEffect(() => {
    (async () => {
      launchingIdRef.current = parseIdFromWindowLabel(
        getCurrentWebviewWindow().label
      );
      const launchingId = launchingIdRef.current;
      if (launchingId) {
        const res = await LaunchService.retrieveGameLog(launchingId);
        if (res.status === "success" && Array.isArray(res.data)) {
          setLogs(res.data);
        }
      }
    })();
  }, []);

  // keep listening to game process output
  useEffect(() => {
    const unlisten = LaunchService.onGameProcessOutput((payload) => {
      setLogs((prevLogs) => [...prevLogs, payload]);
    });
    return () => unlisten();
  }, []);

  const revealRawLogFile = async () => {
    try {
      const launchingId = launchingIdRef.current;
      if (launchingId == null) return;

      const baseDir = await appLogDir();
      const logFilePath = await join(
        baseDir,
        "game",
        `game_log_${launchingId}.log`
      );

      await revealItemInDir(logFilePath);
    } catch (err) {
      logger.error("Failed to open raw log file:", err);
    }
  };

  let lastLevel: string = "INFO";

  const getLogLevel = (log: string): string => {
    const match = log.match(
      /\[\d{2}:\d{2}:\d{2}]\s+\[.*?\/(INFO|WARN|ERROR|DEBUG|FATAL)]/i
    );
    if (match) {
      lastLevel = match[1].toUpperCase();
      return lastLevel;
    }

    if (/^\s+at /.test(log) || /^\s+Caused by:/.test(log) || /^\s+/.test(log)) {
      return lastLevel;
    }

    if (/exception|error|invalid|failed|错误/i.test(log)) {
      lastLevel = "ERROR";
      return "ERROR";
    }

    lastLevel = lastLevel || "INFO";
    return "INFO";
  };

  const filteredLogs = logs.filter((log) => {
    const level = getLogLevel(log);
    return (
      filterStates[level] &&
      log.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const logLevelMap: {
    [key: string]: { colorScheme: string; color: string };
  } = {
    FATAL: { colorScheme: "red", color: "red.500" },
    ERROR: { colorScheme: "orange", color: "orange.500" },
    WARN: { colorScheme: "yellow", color: "yellow.500" },
    INFO: { colorScheme: "gray", color: "gray.600" },
    DEBUG: { colorScheme: "gray", color: "blue.600" },
  };

  const logCounts = logs.reduce<{ [key: string]: number }>((acc, log) => {
    const level = getLogLevel(log);
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});

  // NOTE: smooth scroll may have delay, not always to bottom.
  // const scrollToBottom = () => {
  //   if (logContainerRef.current) {
  //     logContainerRef.current.scrollTo({
  //       top: logContainerRef.current.scrollHeight,
  //       behavior: "smooth",
  //     });
  //   }
  // };

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    if (!logContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 1;
    setIsScrolledToBottom(atBottom);
  };

  // Auto scroll to bottom if user not interacted
  useEffect(() => {
    if (isScrolledToBottom) scrollToBottom();
  }, [filteredLogs, isScrolledToBottom]);

  return (
    <Box p={4} h="100vh" display="flex" flexDirection="column">
      <Flex alignItems="center" mb={4}>
        <Input
          type="text"
          placeholder={t("GameLogPage.placeholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="sm"
          w="200px"
          mr={4}
          focusBorderColor={`${primaryColor}.500`}
        />
        <Spacer />
        {Object.keys(logLevelMap).map((level) => (
          <Button
            key={level}
            size="xs"
            variant={filterStates[level] ? "solid" : "subtle"}
            onClick={() =>
              setFilterStates({
                ...filterStates,
                [level]: !filterStates[level],
              })
            }
            mr={2}
            colorScheme={logLevelMap[level].colorScheme}
          >
            {level} ({logCounts[level] || 0})
          </Button>
        ))}
        <Tooltip label={t("GameLogPage.revealRawLog")} placement="bottom">
          <IconButton
            icon={<LuFileInput />}
            aria-label={t("GameLogPage.revealRawLog")}
            variant="ghost"
            size="sm"
            colorScheme="gray"
            onClick={revealRawLogFile}
          />
        </Tooltip>
        <Tooltip label={t("GameLogPage.clearLogs")} placement="bottom">
          <IconButton
            icon={<LuTrash />}
            aria-label={t("GameLogPage.clearLogs")}
            variant="ghost"
            size="sm"
            colorScheme="gray"
            onClick={clearLogs}
          />
        </Tooltip>
      </Flex>

      <Box
        ref={logContainerRef}
        borderWidth="1px"
        borderRadius="md"
        p={2}
        flex="1"
        className={`${styles["log-list-container"]}`}
        onScroll={handleScroll}
      >
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log, index) => {
            const level = getLogLevel(log);
            return (
              <Text
                key={index}
                className={`${styles["log-text"]}`}
                color={logLevelMap[level].color}
                fontWeight={!["INFO", "DEBUG"].includes(level) ? 600 : 400}
              >
                {log}
              </Text>
            );
          })
        ) : (
          <Empty colorScheme="gray" withIcon={false} />
        )}

        {!isScrolledToBottom && (
          <Button
            position="absolute"
            bottom={7}
            right={7}
            size="sm"
            variant="subtle"
            boxShadow="md"
            onClick={() => {
              scrollToBottom();
            }}
            leftIcon={<LuChevronsDown />}
          >
            {t("GameLogPage.scrollToBottom")}
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default GameLogPage;

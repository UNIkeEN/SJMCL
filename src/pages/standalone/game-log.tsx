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
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronsDown, LuFileInput, LuTrash } from "react-icons/lu";
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  ListRowRenderer,
} from "react-virtualized";
import "react-virtualized/styles.css";
import Empty from "@/components/common/empty";
import { useLauncherConfig } from "@/contexts/config";
import { LaunchService } from "@/services/launch";
import styles from "@/styles/game-log.module.css";
import { parseIdFromWindowLabel } from "@/utils/window";

type LogLevel = "FATAL" | "ERROR" | "WARN" | "INFO" | "DEBUG";

const GameLogPage: React.FC = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [logs, setLogs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStates, setFilterStates] = useState<Record<LogLevel, boolean>>({
    FATAL: true,
    ERROR: true,
    WARN: true,
    INFO: true,
    DEBUG: true,
  });
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);

  const launchingIdRef = useRef<number | null>(null);
  const listRef = useRef<List>(null);

  const cacheRef = useRef(
    new CellMeasurerCache({
      fixedWidth: true,
      defaultHeight: 20,
    })
  );

  const logLevelMap: Record<
    LogLevel,
    { colorScheme: string; textColor: string }
  > = {
    FATAL: { colorScheme: "red", textColor: "red.500" },
    ERROR: { colorScheme: "orange", textColor: "orange.500" },
    WARN: { colorScheme: "yellow", textColor: "yellow.500" },
    INFO: { colorScheme: "gray", textColor: "gray.600" },
    DEBUG: { colorScheme: "blue", textColor: "blue.600" },
  };

  const clearLogs = () => setLogs([]);

  // invoke retrieve on first load
  useEffect(() => {
    (async () => {
      launchingIdRef.current = parseIdFromWindowLabel(
        getCurrentWebview().label
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
    if (!launchingIdRef.current) return;

    const baseDir = await appLogDir();
    const logFilePath = await join(
      baseDir,
      "game",
      `game_log_${launchingIdRef.current}.log`
    );

    await revealItemInDir(logFilePath);
  };

  const lastLevelRef = useRef<LogLevel>("INFO");

  const getLogLevel = useCallback((log: string): LogLevel => {
    const match = log.match(
      /\[\d{2}:\d{2}:\d{2}]\s+\[.*?\/(INFO|WARN|ERROR|DEBUG|FATAL)]/i
    );

    if (match) {
      const level = match[1].toUpperCase() as LogLevel;
      lastLevelRef.current = level;
      return level;
    }
    if (/^\s+/.test(log)) {
      return lastLevelRef.current;
    }
    if (/exception|error|invalid|failed|错误/i.test(log)) {
      lastLevelRef.current = "ERROR";
      return "ERROR";
    }
    return lastLevelRef.current;
  }, []);

  const logCounts = useMemo<Record<LogLevel, number>>(() => {
    const counts: Record<LogLevel, number> = {
      FATAL: 0,
      ERROR: 0,
      WARN: 0,
      INFO: 0,
      DEBUG: 0,
    };

    for (const log of logs) {
      const level = getLogLevel(log);
      counts[level]++;
    }

    return counts;
  }, [logs, getLogLevel]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const level = getLogLevel(log);
      return (
        filterStates[level] &&
        log.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [logs, filterStates, searchTerm, getLogLevel]);

  const rowRenderer: ListRowRenderer = ({ key, index, style, parent }) => {
    const log = filteredLogs[index];
    const level = getLogLevel(log);

    return (
      <CellMeasurer
        key={key}
        cache={cacheRef.current}
        parent={parent}
        rowIndex={index}
        columnIndex={0}
      >
        <div style={style}>
          <Text
            className={styles["log-text"]}
            color={logLevelMap[level].textColor}
            fontWeight={!["INFO", "DEBUG"].includes(level) ? 600 : 400}
            whiteSpace="pre-wrap"
            wordBreak="break-word"
            lineHeight="1.4"
          >
            {log}
          </Text>
        </div>
      </CellMeasurer>
    );
  };

  // Reset list cache and recalculate row heights on filteredLogs update
  useEffect(() => {
    cacheRef.current.clearAll();
    listRef.current?.recomputeRowHeights();
  }, [filteredLogs]);

  const levels = Object.keys(logLevelMap) as LogLevel[];

  return (
    <Box p={4} h="100vh" display="flex" flexDirection="column">
      <Flex align="center" mb={4}>
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

        {levels.map((level) => (
          <Button
            key={level}
            size="xs"
            variant={filterStates[level] ? "solid" : "subtle"}
            onClick={() =>
              setFilterStates((s) => ({
                ...s,
                [level]: !s[level],
              }))
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

      <Box flex="1" borderWidth="1px" borderRadius="md" position="relative">
        {filteredLogs.length === 0 ? (
          <Empty withIcon={false} />
        ) : (
          <AutoSizer>
            {({ width, height }) => (
              <List
                ref={listRef}
                width={width}
                height={height}
                rowCount={filteredLogs.length}
                deferredMeasurementCache={cacheRef.current}
                rowHeight={cacheRef.current.rowHeight}
                rowRenderer={rowRenderer}
                onScroll={({ clientHeight, scrollHeight, scrollTop }) => {
                  setIsScrolledToBottom(
                    scrollHeight - scrollTop - clientHeight < 2
                  );
                }}
              />
            )}
          </AutoSizer>
        )}

        {!isScrolledToBottom && (
          <Button
            position="absolute"
            bottom={7}
            right={7}
            size="sm"
            variant="subtle"
            boxShadow="md"
            leftIcon={<LuChevronsDown />}
            onClick={() =>
              listRef.current?.scrollToRow(filteredLogs.length - 1)
            }
          >
            {t("GameLogPage.scrollToBottom")}
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default GameLogPage;

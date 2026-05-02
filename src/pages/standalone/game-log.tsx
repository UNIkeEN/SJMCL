import {
  Box,
  Button,
  Text as ChakraText,
  Flex,
  IconButton,
  Input,
  Spacer,
  Tooltip,
} from "@chakra-ui/react";
import { appLogDir, join } from "@tauri-apps/api/path";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { clamp } from "@/utils/math";
import { parseIdFromWindowLabel } from "@/utils/window";

type LogLevel = "FATAL" | "ERROR" | "WARN" | "INFO" | "DEBUG";
type LogSelectionRange = { start: number; end: number };
type LogSelectionState = {
  range: LogSelectionRange | null;
  selecting: boolean;
};

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

  const launchingIdRef = useRef<number | null>(null);
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const cacheRef = useRef(
    new CellMeasurerCache({
      fixedWidth: true,
      defaultHeight: 20,
    })
  );

  const logSelectionStateRef = useRef<LogSelectionState>({
    range: null,
    selecting: false,
  });

  useEffect(() => {
    (async () => {
      await getCurrentWebviewWindow().setTitle(t("Tauri.windowTitle.gameLog"));
    })();
  }, [t]);

  useEffect(() => {
    (async () => {
      launchingIdRef.current = parseIdFromWindowLabel(
        getCurrentWebviewWindow().label
      );
      const launchingId = launchingIdRef.current;
      if (!launchingId) return;

      const res = await LaunchService.retrieveGameLog(launchingId);
      if (res.status === "success" && Array.isArray(res.data)) {
        setLogs(res.data);
      }
    })();
  }, []);

  // ------- Live log stream and auto scroll -------

  useEffect(() => {
    const unlisten = LaunchService.onGameProcessOutput((payload) => {
      setLogs((prevLogs) => [...prevLogs, payload]);
    });
    return () => unlisten();
  }, []);

  useEffect(() => {
    if (userScrolledRef.current) return;

    requestAnimationFrame(() => {
      listRef.current?.scrollToRow(logs.length - 1);
    });
  }, [logs.length]);

  // ------- Log level styling, parsing and filtering -------

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

  const logLevels = useMemo<LogLevel[]>(() => {
    const levels: LogLevel[] = [];
    let lastLevel: LogLevel = "INFO";

    for (const log of logs) {
      const match = log.match(
        /\[\d{2}:\d{2}:\d{2}]\s+\[.*?\/(INFO|WARN|ERROR|DEBUG|FATAL)]/i
      );

      if (match) {
        lastLevel = match[1].toUpperCase() as LogLevel;
      } else if (
        !(
          /^\s+at /.test(log) ||
          /^\s+Caused by:/.test(log) ||
          /^\s+/.test(log)
        ) &&
        /exception|error|invalid|failed|错误/i.test(log)
      ) {
        lastLevel = "ERROR";
      }

      levels.push(lastLevel);
    }

    return levels;
  }, [logs]);

  const logCounts = useMemo<Record<LogLevel, number>>(() => {
    const counts: Record<LogLevel, number> = {
      FATAL: 0,
      ERROR: 0,
      WARN: 0,
      INFO: 0,
      DEBUG: 0,
    };

    logLevels.forEach((level) => {
      counts[level]++;
    });

    return counts;
  }, [logLevels]);

  const filteredLogs = useMemo(() => {
    return logs
      .map((log, index) => ({
        log,
        level: logLevels[index],
      }))
      .filter(
        ({ log, level }) =>
          filterStates[level] &&
          log.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [logs, logLevels, filterStates, searchTerm]);

  // ------- Custom multi-row selection and copy handler (to fix issue#1462) -------

  const resetLogSelection = () => {
    logSelectionStateRef.current = {
      range: null,
      selecting: false,
    };
  };

  const handleLogMouseDown = (
    index: number,
    event: MouseEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) return;

    logSelectionStateRef.current = {
      range: { start: index, end: index },
      selecting: true,
    };
  };

  const handleLogMouseEnter = (index: number) => {
    const selectionState = logSelectionStateRef.current;
    if (!selectionState.selecting || !selectionState.range) return;

    selectionState.range.end = index;
  };

  const isTextInputTarget = (target: EventTarget | null) => {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    );
  };

  useEffect(() => {
    const handleMouseUp = () => {
      logSelectionStateRef.current.selecting = false;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (
        (config.basicInfo.osType === "macos" &&
          (key !== "a" || !event.metaKey || event.ctrlKey || event.altKey)) ||
        (config.basicInfo.osType !== "macos" &&
          (key !== "a" || !event.ctrlKey || event.metaKey || event.altKey))
      ) {
        return;
      }

      const target = event.target;
      if (isTextInputTarget(target)) return;
      const targetNode = target instanceof Node ? target : null;

      if (
        !containerRef.current?.contains(targetNode) &&
        targetNode !== document.body
      ) {
        return;
      }

      event.preventDefault();
    };

    const handleCopy = (event: ClipboardEvent) => {
      const selection = window.getSelection();
      const { range } = logSelectionStateRef.current;
      const selectedText = selection?.toString() ?? "";

      if (!range || selectedText.length === 0 || range.start === range.end) {
        return;
      }

      const start = clamp(
        Math.min(range.start, range.end),
        0,
        filteredLogs.length - 1
      );
      const end = clamp(
        Math.max(range.start, range.end),
        0,
        filteredLogs.length - 1
      );

      if (start > end) return;

      const text = filteredLogs
        .slice(start, end + 1)
        .map(({ log }) => log)
        .join("\n");
      if (text.length === 0) return;

      event.clipboardData?.setData("text/plain", text);
      event.preventDefault();
    };

    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("copy", handleCopy);

    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("copy", handleCopy);
    };
  }, [config.basicInfo.osType, filteredLogs]);

  useEffect(() => {
    resetLogSelection();
    cacheRef.current.clearAll();
    listRef.current?.recomputeRowHeights();
  }, [filterStates, searchTerm]);

  // --------------------------------------------------

  const clearLogs = () => setLogs([]);

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

  const rowRenderer: ListRowRenderer = ({ key, index, style, parent }) => {
    const { log, level } = filteredLogs[index];

    return (
      <CellMeasurer
        key={key}
        cache={cacheRef.current}
        parent={parent}
        rowIndex={index}
        columnIndex={0}
      >
        <div
          data-log-index={index}
          style={style}
          onMouseDown={(event) => handleLogMouseDown(index, event)}
          onMouseEnter={() => handleLogMouseEnter(index)}
        >
          <ChakraText
            className={styles["log-text"]}
            color={logLevelMap[level].textColor}
            fontWeight={!["INFO", "DEBUG"].includes(level) ? 600 : 400}
            whiteSpace="pre-wrap"
            wordBreak="break-word"
            lineHeight="1.4"
            userSelect={"text"}
          >
            {log}
          </ChakraText>
        </div>
      </CellMeasurer>
    );
  };

  const levels = Object.keys(logLevelMap) as LogLevel[];

  return (
    <Box
      ref={containerRef}
      p={4}
      h="100vh"
      display="flex"
      flexDirection="column"
    >
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

        {levels.map((level) => (
          <Button
            key={level}
            size="xs"
            variant={filterStates[level] ? "solid" : "outline"}
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
                  const atBottom = scrollHeight - scrollTop - clientHeight < 2;
                  setIsScrolledToBottom(atBottom);
                  userScrolledRef.current = !atBottom;
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
            onClick={() => {
              if (userScrolledRef.current) {
                userScrolledRef.current = false;
              }
              listRef.current?.scrollToRow(filteredLogs.length - 1);
            }}
          >
            {t("GameLogPage.scrollToBottom")}
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default GameLogPage;

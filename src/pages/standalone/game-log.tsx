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
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronsDown, LuFileInput, LuTrash } from "react-icons/lu";
import Empty from "@/components/common/empty";
import { useLauncherConfig } from "@/contexts/config";
import { LaunchService } from "@/services/launch";
import styles from "@/styles/game-log.module.css";

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
  const [isUserInteracting, setIsUserInteracting] = useState(false); // Track user interaction (scroll, select)
  const logContainerRef = useRef<HTMLDivElement>(null);

  const clearLogs = () => setLogs([]);

  useEffect(() => {
    const unlisten = LaunchService.onGameProcessOutput((payload) => {
      setLogs((prevLogs) => [...prevLogs, payload]);
    });
    return () => unlisten();
  }, []);

  const getLogLevel = (log: string): string => {
    for (const keyword of Object.keys(filterStates)) {
      const index = log.indexOf(keyword);
      if (index !== -1) {
        return keyword;
      }
    }

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

  const isAtBottom = () => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
      return scrollHeight - scrollTop - clientHeight < 1;
    }
    return false;
  };

  // Auto scroll to bottom if user not interacted
  useEffect(() => {
    if (!isUserInteracting) scrollToBottom();
  }, [filteredLogs, isUserInteracting]);

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
        <Tooltip label={t("GameLogPage.exportLogs")} placement="bottom">
          <IconButton
            icon={<LuFileInput />}
            aria-label={t("GameLogPage.exportLogs")}
            variant="ghost"
            size="sm"
            colorScheme="gray"
            isDisabled
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
        onScroll={() => setIsUserInteracting(!isAtBottom())}
        onMouseDown={() => setIsUserInteracting(true)}
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

        {!isAtBottom() && (
          <Button
            position="absolute"
            bottom={7}
            right={7}
            size="sm"
            variant="subtle"
            boxShadow="md"
            onClick={() => {
              scrollToBottom();
              setIsUserInteracting(false);
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

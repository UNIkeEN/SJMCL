import {
  Box,
  Button,
  Flex,
  IconButton,
  Input,
  Spacer,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFileInput, LuTrash } from "react-icons/lu";
import Empty from "@/components/common/empty";
import { useLauncherConfig } from "@/contexts/config";
import styles from "@/styles/game-log.module.css";

const GameLogPage: React.FC = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const [logs, setLogs] = useState<string[]>([
    "16:14:57.388 [INFO] Using default game log configuration client-1.21.2.xml",
    "16:14:59.111 [DEBUG] Datafiner optimization took 292 milliseconds",
    "16:14:52.821 [WARN] Error parsing option value 0 for option Msx framerate",
    "16:14:52.944 [ERROR] Value 0 outside of range [10:260]",
    "16:14:55.628 [INFO] OpensL initialized on device OpensL Soft",
    "16:14:55.628 [INFO] Another info log",
    "16:14:55.628 [DEBUG] Debugging log",
    "16:14:55.628 [WARN] Warning log",
    "16:14:55.628 [ERROR] Error log",
    "16:14:55.628 [FATAL] Fatal error occurred",
  ]);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStates, setFilterStates] = useState<{ [key: string]: boolean }>({
    FATAL: true,
    ERROR: true,
    WARN: true,
    INFO: true,
    DEBUG: true,
  });

  const clearLogs = () => setLogs([]);

  const filteredLogs = logs.filter((log) => {
    const level = log.split(" ")[1].slice(1, -1);
    return (
      filterStates[level] &&
      log.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const logLevelMap: {
    [key: string]: { colorScheme: string; color: string };
  } = {
    FATAL: { colorScheme: "red", color: "red.600" },
    ERROR: { colorScheme: "orange", color: "orange.600" },
    WARN: { colorScheme: "yellow", color: "yellow.600" },
    INFO: { colorScheme: "gray", color: "gray.600" },
    DEBUG: { colorScheme: "gray", color: "blue.600" },
  };

  const logCounts = filteredLogs.reduce<{ [key: string]: number }>(
    (acc, log) => {
      const level = log.split(" ")[1].slice(1, -1);
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <Box p={4} minH="100vh" display="flex" flexDirection="column">
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
        borderWidth="1px"
        borderRadius="md"
        p={2}
        flex="1"
        overflowY="auto"
        bg="white"
      >
        {filteredLogs.length > 0 ? (
          <VStack align="start" spacing={0.5}>
            {filteredLogs.map((log, index) => {
              const level = log.split(" ")[1].slice(1, -1);
              return (
                <Text
                  key={index}
                  className={`${styles["log-text"]}`}
                  color={logLevelMap[level].color}
                  fontSize="xs"
                >
                  {log}
                </Text>
              );
            })}
          </VStack>
        ) : (
          <Empty colorScheme="gray" withIcon={false} />
        )}
      </Box>
    </Box>
  );
};

export default GameLogPage;

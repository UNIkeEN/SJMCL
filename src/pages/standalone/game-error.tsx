import {
  Button,
  Divider,
  Flex,
  HStack,
  Stat,
  StatLabel,
  StatNumber,
  VStack,
} from "@chakra-ui/react";
import { arch, platform } from "@tauri-apps/plugin-os";
import React from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";
import { createWindow } from "@/utils/window";

const GameErrorPage: React.FC = () => {
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { t } = useTranslation();
  const gameInfo = {
    launcherVersion: config.version,
    gameVersion: "1.20.1 Fabric",
    physicalMemory: "16274 MB",
    gameMemory: "6518 MB",
    javaVersion: "21.0.3",
    os: platform()
      .replace("bsd", "BSD")
      .replace("os", "OS") //macos
      .replace("\w", (match) => match.toUpperCase()),
    architecture: arch(),
    minecraftVersion: "1.20.1",
    fabricVersion: "0.15.6",
    gamePath: "G:\\Minecraft\\.minecraft",
    javaPath: "D:\\Program Files\\Zulu\\zulu-21\\bin\\java.exe",
    crashReason: "当前游戏因为代码不完整，无法继续运行。",
  };

  const PCData = [
    { label: "launcherVersion", value: gameInfo.launcherVersion },
    { label: "gameVersion", value: gameInfo.gameVersion },
    { label: "physicalMemory", value: gameInfo.physicalMemory },
    { label: "gameMemory", value: gameInfo.gameMemory },
    { label: "java", value: gameInfo.javaVersion },
    { label: "os", value: gameInfo.os },
    { label: "architecture", value: gameInfo.architecture },
  ];

  const gameData = [
    { label: "minecraft", value: gameInfo.minecraftVersion },
    { label: "fabric", value: gameInfo.fabricVersion },
  ];

  return (
    <VStack align="stretch" spacing={6} w="full" p={6}>
      <HStack justify="space-between" spacing={6}>
        {PCData.map((item, index) => (
          <Stat key={index}>
            <StatLabel fontWeight="bold" fontSize="md">
              {t(`GameErrorPage.${item.label}`)}
            </StatLabel>
            <StatNumber fontWeight="normal" fontSize="sm">
              {item.value}
            </StatNumber>
          </Stat>
        ))}
      </HStack>
      <Divider />

      <HStack justify="flex-start">
        {gameData.map((item, index) => (
          <Stat key={index} textAlign="left">
            <StatLabel fontWeight="bold" fontSize="md">
              {t(`GameErrorPage.${item.label}`)}
            </StatLabel>
            <StatNumber fontWeight="normal" fontSize="sm">
              {item.value}
            </StatNumber>
          </Stat>
        ))}
      </HStack>
      <Divider />

      <Stat>
        <StatLabel fontWeight="bold" fontSize="md">
          {t("GameErrorPage.gamePath")}
        </StatLabel>
        <StatNumber fontWeight="normal" fontSize="sm">
          {gameInfo.gamePath}
        </StatNumber>
      </Stat>
      <Divider />

      <Stat>
        <StatLabel fontWeight="bold" fontSize="md">
          {t("GameErrorPage.javaPath")}
        </StatLabel>
        <StatNumber fontWeight="normal" fontSize="sm">
          {gameInfo.javaPath}
        </StatNumber>
      </Stat>
      <Divider />

      <Stat>
        <StatLabel fontWeight="bold" fontSize="md">
          {t("GameErrorPage.crashReason")}
        </StatLabel>
        <StatNumber fontWeight="normal" fontSize="sm">
          {t("GameErrorPage.notice") + gameInfo.crashReason}
        </StatNumber>
      </Stat>

      <HStack justify="flex-start" position="sticky">
        <Button colorScheme={primaryColor} variant="solid">
          {t("GameErrorPage.exportGameInfo")}
        </Button>
        <Button colorScheme={primaryColor} variant="solid">
          {t("GameErrorPage.gameLogs")}
        </Button>
        <Button colorScheme={primaryColor} variant="solid">
          {t("GameErrorPage.help")}
        </Button>
      </HStack>
    </VStack>
  );
};

export default GameErrorPage;

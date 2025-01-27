import {
  Button,
  Divider,
  HStack,
  Stat,
  StatLabel,
  StatNumber,
  VStack,
} from "@chakra-ui/react";
import { arch, platform } from "@tauri-apps/plugin-os";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLauncherConfig } from "@/contexts/config";

const GameErrorPage: React.FC = () => {
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { t } = useTranslation();
  const [os, setOs] = useState<string | null>(null);
  const [architecture, setArchitecture] = useState<string | null>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      const platformInfo = await platform();
      const archInfo = await arch();
      setOs(
        platformInfo
          .replace("bsd", "BSD")
          .replace(/\w/, (match) => match.toUpperCase())
          .replace("Macos", "macOS")
      );
      setArchitecture(archInfo);
    };
    fetchInfo();
  }, []);

  const BasicInfo = {
    launcherVersion: config.version,
    os: os,
    architecture: architecture,
  };

  const PCInfo = [
    { label: "launcherVersion", value: BasicInfo.launcherVersion },
    { label: "gameVersion", value: "1.20.1 Fabric" },
    { label: "physicalMemory", value: "16274 MB" },
    { label: "gameMemory", value: "6518 MB" },
    { label: "java", value: "21.0.3" },
    { label: "os", value: BasicInfo.os },
    { label: "architecture", value: BasicInfo.architecture },
  ];

  const gameInfo = [
    { label: "minecraft", value: "1.20.1" },
    { label: "fabric", value: "0.15.6" },
  ];

  return (
    <VStack align="stretch" spacing={6} w="full" p={6}>
      <HStack justify="space-between" spacing={6}>
        {PCInfo.map((item, index) => (
          <Stat key={index}>
            <StatLabel fontWeight="bold" fontSize="md">
              {t(`GameErrorPage.PCInfo.${item.label}`)}
            </StatLabel>
            <StatNumber fontWeight="normal" fontSize="sm">
              {item.value}
            </StatNumber>
          </Stat>
        ))}
      </HStack>
      <Divider />

      <HStack justify="flex-start">
        {gameInfo.map((item, index) => (
          <Stat key={index} textAlign="left">
            <StatLabel fontWeight="bold" fontSize="md">
              {t(`GameErrorPage.gameInfo.${item.label}`)}
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
          {t("GameErrorPage.gameInfo.gamePath")}
        </StatLabel>
        <StatNumber fontWeight="normal" fontSize="sm">
          {"G:\\Minecraft\\.minecraft"}
        </StatNumber>
      </Stat>
      <Divider />

      <Stat>
        <StatLabel fontWeight="bold" fontSize="md">
          {t("GameErrorPage.PCInfo.javaPath")}
        </StatLabel>
        <StatNumber fontWeight="normal" fontSize="sm">
          {"D:\\Program Files\\Zulu\\zulu-21\\bin\\java.exe"}
        </StatNumber>
      </Stat>
      <Divider />

      <Stat>
        <StatLabel fontWeight="bold" fontSize="md">
          {t("GameErrorPage.errorInfo.crashReason")}
        </StatLabel>
        <StatNumber fontWeight="normal" fontSize="sm">
          {t("GameErrorPage.errorInfo.notice") +
            "当前游戏因为代码不完整，无法继续运行。"}
        </StatNumber>
      </Stat>

      <HStack justify="flex-start" position="sticky">
        <Button colorScheme={primaryColor} variant="solid">
          {t("GameErrorPage.button.exportGameInfo")}
        </Button>
        <Button colorScheme={primaryColor} variant="solid">
          {t("GameErrorPage.button.gameLogs")}
        </Button>
        <Button colorScheme={primaryColor} variant="solid">
          {t("GameErrorPage.button.help")}
        </Button>
      </HStack>
    </VStack>
  );
};

export default GameErrorPage;

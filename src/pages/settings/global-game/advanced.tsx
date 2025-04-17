import GameAdvancedSettingsGroups from "@/components/game-advanced-settings-group";
import { useLauncherConfig } from "@/contexts/config";

const GlobalGameAdvancedSettingsPage = () => {
  const { config, update } = useLauncherConfig();
  const globalGameConfigs = config.globalGameConfig;

  return (
    <GameAdvancedSettingsGroups
      gameConfig={globalGameConfigs}
      updateGameConfig={(key: string, value: any) => {
        update(`globalGameConfig.${key}`, value);
      }}
    />
  );
};

export default GlobalGameAdvancedSettingsPage;

import GameAdvancedSettingsGroups from "@/components/game-advanced-settings-group";
import { useInstanceSharedData } from "@/contexts/instance";

const InstanceGameAdvancedSettingsPage = () => {
  const { gameConfig: instanceGameConfig, handleUpdateInstanceConfig } =
    useInstanceSharedData();

  return (
    <>
      {instanceGameConfig && (
        <GameAdvancedSettingsGroups
          gameConfig={instanceGameConfig}
          updateGameConfig={(key: string, value: any) => {
            handleUpdateInstanceConfig(`specGameConfig.${key}`, value);
          }}
        />
      )}
    </>
  );
};

export default InstanceGameAdvancedSettingsPage;

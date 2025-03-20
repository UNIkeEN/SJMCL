import { Button, Card, Heading, Text, VStack } from "@chakra-ui/react";
import { t } from "i18next";
import { useLauncherConfig } from "@/contexts/config";

interface OAuthLoginPanelProps {
  authType: "microsoft" | "3rdparty";
  authCode?: string;
  callback: () => void;
  isLoading: boolean;
}

const OAuthLoginPanel: React.FC<OAuthLoginPanelProps> = ({
  authType,
  authCode,
  callback,
  isLoading,
}) => {
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const localeSuffix = authCode ? "next" : "start." + authType;

  return (
    <Card
      h="136px" // same as to inputs
      w="100%"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <VStack>
        {authCode && (
          <Heading size="lg" color={`${primaryColor}.500`}>
            {authCode}
          </Heading>
        )}
        <Text fontSize="sm">
          {t(`AddPlayerModal.oauthCommon.description.${localeSuffix}`)}
        </Text>
        <Button
          colorScheme={primaryColor}
          onClick={callback}
          isLoading={isLoading}
        >
          {t(`AddPlayerModal.oauthCommon.button.${localeSuffix}`)}
        </Button>
      </VStack>
    </Card>
  );
};

export default OAuthLoginPanel;

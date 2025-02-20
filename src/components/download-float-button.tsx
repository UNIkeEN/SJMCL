import {
  Button,
  Card,
  Center,
  CircularProgress,
  CircularProgressLabel,
  Icon,
  Tooltip,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { LuArrowDownToLine } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";
import { useThemedCSSStyle } from "@/hooks/themed-css";

export const DownloadFloatButton: React.FC = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const router = useRouter();
  const themedStyles = useThemedCSSStyle();

  return (
    <Card
      className={themedStyles.card["card-back"]}
      position="absolute"
      top={4}
      right={4}
      p="3.5px"
    >
      <Tooltip label={t("DownloadFloatButton.tooltip")}>
        <Button
          variant="ghost"
          // colorScheme="blackAlpha"
          p={1}
          size="auto"
          onClick={() => {
            router.push("/downloads");
          }}
        >
          <CircularProgress
            color={`${primaryColor}.500`}
            size="30px"
            value={80}
          >
            <CircularProgressLabel>
              <Center w="100%">
                <Icon as={LuArrowDownToLine} boxSize={3.5} />
              </Center>
            </CircularProgressLabel>
          </CircularProgress>
        </Button>
      </Tooltip>
    </Card>
  );
};

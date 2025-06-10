import {
  Box,
  Button,
  Center,
  CircularProgress,
  CircularProgressLabel,
  Icon,
  Tooltip,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { LuArrowDownToLine } from "react-icons/lu";
import AdvancedCard from "@/components/common/advanced-card";
import { useLauncherConfig } from "@/contexts/config";

export const DownloadFloatButton: React.FC = () => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const router = useRouter();

  return (
    <Box position="absolute" top={4} right={4}>
      <AdvancedCard p="3.5px">
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
      </AdvancedCard>
    </Box>
  );
};

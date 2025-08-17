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
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowDownToLine, LuCheck, LuCircleAlert } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";
import { useTaskContext } from "@/contexts/task";
import { RuntimeStateEnums } from "@/models/task";

export const DownloadIndicator: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const { tasks, generalPercent } = useTaskContext();
  const primaryColor = config.appearance.theme.primaryColor;

  const [showCheckIcon, setShowCheckIcon] = useState(false);

  const isAllCompleted =
    tasks.every(
      (group) =>
        group.status === RuntimeStateEnums.Completed ||
        group.status === RuntimeStateEnums.Cancelled
    ) && tasks.some((group) => group.status === RuntimeStateEnums.Completed);

  const hasError = tasks.some(
    (task) => task.status === RuntimeStateEnums.Failed
  );

  useEffect(() => {
    if (isAllCompleted) {
      setShowCheckIcon(true);
      const timer = setTimeout(() => {
        setShowCheckIcon(false);
      }, 10000);
      return () => clearTimeout(timer);
    } else {
      setShowCheckIcon(false);
    }
  }, [isAllCompleted]);

  return (
    <Tooltip label={t("DownloadTasksPage.title")}>
      <Button
        variant="ghost"
        // colorScheme="blackAlpha"
        size="auto"
        borderRadius="full"
        onClick={() => {
          router.push("/downloads");
        }}
        className="drop-in-elastic"
      >
        {!isAllCompleted && !hasError ? (
          <CircularProgress
            color={`${primaryColor}.500`}
            size="30px"
            value={generalPercent}
          >
            <CircularProgressLabel>
              <Center w="100%">
                <Icon as={LuArrowDownToLine} boxSize={3.5} />
              </Center>
            </CircularProgressLabel>
          </CircularProgress>
        ) : (
          <Box position="relative" boxSize="30px">
            <Center w="100%" h="100%">
              <Icon as={LuArrowDownToLine} boxSize={3.5} />
            </Center>
            {isAllCompleted && (
              <Box
                position="absolute"
                bottom="1px"
                right="3px"
                opacity={showCheckIcon ? 1 : 0}
                transition="opacity 0.5s ease-in-out"
              >
                <Icon
                  as={LuCheck}
                  boxSize={2.5}
                  bgColor={`${primaryColor}.500`}
                  color="white"
                  borderRadius="full"
                  padding="1.5px"
                />
              </Box>
            )}
            {hasError && (
              <Icon
                as={LuCircleAlert}
                boxSize={2.5}
                bgColor={`yellow.500`}
                color="white"
                position="absolute"
                bottom="5px"
                right="3px"
                borderRadius="full"
              />
            )}
          </Box>
        )}
      </Button>
    </Tooltip>
  );
};

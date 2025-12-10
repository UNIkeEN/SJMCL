import {
  IconButton,
  Link,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverProps,
  PopoverTrigger,
  Text,
  VStack,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import { LuCircleHelp } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";

const MCVersionNumberHelper: React.FC<PopoverProps> = (props) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  return (
    <Popover {...props}>
      <PopoverTrigger>
        <IconButton
          icon={<LuCircleHelp size={14} />}
          size="xs"
          variant="ghost"
          aria-label="version-numbering-help"
        />
      </PopoverTrigger>
      <PopoverContent width="xs">
        <PopoverBody fontSize="xs-sm">
          <VStack align="stretch">
            <Text>{t("MCVersionNumberHelper.content")}</Text>
            <Link
              color={`${primaryColor}.500`}
              onClick={() => {
                openUrl(t("MCVersionNumberHelper.url"));
              }}
              fontSize="xs"
            >
              {t("MCVersionNumberHelper.linkText")}
            </Link>
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default MCVersionNumberHelper;

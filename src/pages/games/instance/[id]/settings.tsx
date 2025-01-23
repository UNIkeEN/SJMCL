import { Box, Button, Collapse, Fade, Switch } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import Editable from "@/components/common/editable";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import GlobalGameSettings from "@/components/global-game-settings";
import { useLauncherConfig } from "@/contexts/config";
import { InstanceContext } from "@/contexts/instance";

const InstanceSettingsPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const instanceCtx = useContext(InstanceContext);

  const [applySettings, setApplySettings] = useState<boolean>(false);

  const InstanceSettingGroups: OptionItemGroupProps[] = [
    {
      items: [
        {
          title: t("InstanceSettingsPage.name"),
          children: (
            <Editable // TBD
              isTextArea={false}
              value={instanceCtx.summary?.name || ""}
              onEditSubmit={(value) => {}}
              textProps={{ className: "secondary-text", fontSize: "xs" }}
              inputProps={{ fontSize: "xs" }}
            />
          ),
        },
        {
          title: t("InstanceSettingsPage.description"),
          children: (
            <Editable // TBD
              isTextArea={true}
              value={instanceCtx.summary?.description || ""}
              onEditSubmit={(value) => {}}
              textProps={{ className: "secondary-text", fontSize: "xs" }}
              inputProps={{ fontSize: "xs" }}
            />
          ),
        },
        {
          title: t("InstanceSettingsPage.applySettings"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={applySettings}
              onChange={(event) => {
                setApplySettings(event.target.checked);
              }}
            />
          ),
        },
        ...(applySettings
          ? [
              {
                title: t("InstanceSettingsPage.restoreSettings"),
                description: t("InstanceSettingsPage.restoreSettingsDesc"),
                children: (
                  <Button
                    colorScheme="red"
                    variant="subtle"
                    size="xs"
                    onClick={() => {}} // TBD
                  >
                    {t("InstanceSettingsPage.restore")}
                  </Button>
                ),
              },
            ]
          : []),
      ],
    },
  ];

  return (
    <Box height="100%" overflowY="auto">
      {InstanceSettingGroups.map((group, index) => (
        <OptionItemGroup title={group.title} items={group.items} key={index} />
      ))}
      <Box h={4} />
      <Collapse in={applySettings} animateOpacity>
        <GlobalGameSettings instanceId={Number(router.query.id)} />
      </Collapse>
    </Box>
  );
};

export default InstanceSettingsPage;

import {
  Box,
  Button,
  Collapse,
  HStack,
  Image,
  Switch,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import Editable from "@/components/common/editable";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { GameIconSelectorPopover } from "@/components/game-icon-selector";
import GameSettingsGroups from "@/components/game-settings-groups";
import { useLauncherConfig } from "@/contexts/config";
import { InstanceContext } from "@/contexts/instance";

const InstanceSettingsPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const { id } = router.query;
  const instanceId = Array.isArray(id) ? id[0] : id;
  const primaryColor = config.appearance.theme.primaryColor;
  const globalGameConfigs = config.globalGameConfig;
  const instanceCtx = useContext(InstanceContext);

  const [applySettings, setApplySettings] = useState<boolean>(false);

  const instanceSpecSettingsGroups: OptionItemGroupProps[] = [
    {
      items: [
        {
          title: t("InstanceSettingsPage.name"),
          children: (
            <Editable // TBD
              isTextArea={false}
              value={instanceCtx.summary?.name || ""}
              onEditSubmit={(value) => {}}
              textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
              inputProps={{ fontSize: "xs-sm" }}
              formErrMsgProps={{ fontSize: "xs-sm" }}
              checkError={(value) => (value.trim() === "" ? 1 : 0)}
              localeKey="InstanceSettingsPage.errorMessage"
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
              textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
              inputProps={{ fontSize: "xs-sm" }}
            />
          ),
        },
        {
          title: t("InstanceSettingsPage.icon"),
          children: (
            <HStack>
              <Image
                src={instanceCtx.summary?.iconSrc}
                alt={instanceCtx.summary?.iconSrc}
                boxSize="28px"
                objectFit="cover"
              />
              <GameIconSelectorPopover // TBD
                value={instanceCtx.summary?.iconSrc}
                onIconSelect={(value) => {}}
              />
            </HStack>
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
              {
                title: t(
                  "GlobalGameSettingsPage.versionIsolation.settings.title"
                ),
                children: (
                  <Switch
                    colorScheme={primaryColor}
                    isChecked={globalGameConfigs.versionIsolation}
                    onChange={(event) => {}} // TBD
                  />
                ),
              },
            ]
          : []),
      ],
    },
  ];

  return (
    <Box height="100%" overflowY="auto">
      <VStack overflow="auto" align="strench" spacing={4} flex="1">
        {instanceSpecSettingsGroups.map((group, index) => (
          <OptionItemGroup
            title={group.title}
            items={group.items}
            key={index}
          />
        ))}
      </VStack>
      <Box h={4} />
      <Collapse in={applySettings} animateOpacity>
        <GameSettingsGroups instanceId={Number(router.query.id)} />
      </Collapse>
    </Box>
  );
};

export default InstanceSettingsPage;

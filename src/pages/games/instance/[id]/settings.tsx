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
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import Editable from "@/components/common/editable";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import { GameIconSelectorPopover } from "@/components/game-icon-selector";
import GameSettingsGroups from "@/components/game-settings-groups";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { useToast } from "@/contexts/toast";
import { InstanceService } from "@/services/instance";

const InstanceSettingsPage = () => {
  const router = useRouter();
  const toast = useToast();
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const globalGameConfigs = config.globalGameConfig;
  const { summary, updateSummary } = useInstanceSharedData();

  const { id } = router.query;
  const instanceId = Array.isArray(id) ? id[0] : id;

  const [applySettings, setApplySettings] = useState<boolean>(false);

  const handleRenameInstance = useCallback(
    (name: string) => {
      InstanceService.renameInstance(Number(instanceId), name).then(
        (response) => {
          if (response.status === "success") {
            updateSummary("name", name);
          } else
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
        }
      );
    },
    [instanceId, toast, updateSummary]
  );

  const instanceSpecSettingsGroups: OptionItemGroupProps[] = [
    {
      items: [
        {
          title: t("InstanceSettingsPage.name"),
          children: (
            <Editable // TBD
              isTextArea={false}
              value={summary?.name || ""}
              onEditSubmit={(value) => {
                handleRenameInstance(value);
              }}
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
              value={summary?.description || ""}
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
                src={summary?.iconSrc}
                alt={summary?.iconSrc}
                boxSize="28px"
                objectFit="cover"
              />
              <GameIconSelectorPopover // TBD
                value={summary?.iconSrc}
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
        <GameSettingsGroups instanceId={Number(instanceId)} />
      </Collapse>
    </Box>
  );
};

export default InstanceSettingsPage;

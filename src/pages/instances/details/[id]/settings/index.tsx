import {
  Box,
  Button,
  Collapse,
  HStack,
  Image,
  Link,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useCallback } from "react";
import { Trans, useTranslation } from "react-i18next";
import Editable from "@/components/common/editable";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import GameSettingsGroups from "@/components/game-settings-groups";
import { InstanceIconSelectorPopover } from "@/components/instance-icon-selector";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { useToast } from "@/contexts/toast";
import { InstanceService } from "@/services/instance";
import { getInstanceIconSrc } from "@/utils/instance";
import { isFileNameSanitized } from "@/utils/string";

const InstanceSettingsPage = () => {
  const router = useRouter();
  const toast = useToast();
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const { id } = router.query;
  const instanceId = Array.isArray(id) ? id[0] : id;

  const {
    summary,
    updateSummaryInContext,
    gameConfig: instanceGameConfig,
    handleUpdateInstanceConfig,
    handleResetInstanceGameConfig,
  } = useInstanceSharedData();
  const useSpecGameConfig = summary?.useSpecGameConfig || false;

  const checkDirNameError = (value: string): number => {
    if (value.trim() === "") return 1;
    if (!isFileNameSanitized(value)) return 2;
    if (value.length > 255) return 3;
    return 0;
  };

  const handleRenameInstance = useCallback(
    (name: string) => {
      if (!instanceId) return;
      InstanceService.renameInstance(instanceId, name).then((response) => {
        if (response.status === "success") {
          updateSummaryInContext("versionPath", response.data);
          updateSummaryInContext("name", name);
        } else
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
      });
    },
    [instanceId, toast, updateSummaryInContext]
  );

  const instanceSpecSettingsGroups: OptionItemGroupProps[] = [
    {
      items: [
        {
          title: t("InstanceSettingsPage.name"),
          children: (
            <Editable
              isTextArea={false}
              value={summary?.name || ""}
              onEditSubmit={handleRenameInstance}
              textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
              inputProps={{ fontSize: "xs-sm" }}
              formErrMsgProps={{ fontSize: "xs-sm" }}
              checkError={checkDirNameError}
              localeKey="InstanceSettingsPage.errorMessage"
              flex={1}
            />
          ),
        },
        {
          title: t("InstanceSettingsPage.description"),
          children: (
            <Editable
              isTextArea={true}
              value={summary?.description || ""}
              onEditSubmit={(value) => {
                handleUpdateInstanceConfig("description", value);
              }}
              textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
              inputProps={{ fontSize: "xs-sm" }}
              flex={1}
            />
          ),
        },
        {
          title: t("InstanceSettingsPage.icon"),
          children: (
            <HStack>
              <Image
                src={getInstanceIconSrc(summary?.iconSrc, summary?.versionPath)}
                alt={summary?.iconSrc}
                boxSize="28px"
                fallbackSrc="/images/icons/JEIcon_Release.png"
              />
              <InstanceIconSelectorPopover
                value={summary?.iconSrc}
                onIconSelect={(value) => {
                  handleUpdateInstanceConfig("iconSrc", value);
                }}
                versionPath={summary?.versionPath}
                instanceId={summary?.id}
              />
            </HStack>
          ),
        },
        {
          title: t("InstanceSettingsPage.applySettings"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={useSpecGameConfig}
              onChange={(event) => {
                handleUpdateInstanceConfig(
                  "useSpecGameConfig",
                  event.target.checked
                );
              }}
            />
          ),
        },
        ...(useSpecGameConfig && instanceGameConfig
          ? [
              {
                title: t("InstanceSettingsPage.restoreSettings"),
                description: t("InstanceSettingsPage.restoreSettingsDesc"),
                children: (
                  <Button
                    colorScheme="red"
                    variant="subtle"
                    size="xs"
                    onClick={() => {
                      handleResetInstanceGameConfig();
                    }}
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
                    isChecked={instanceGameConfig.versionIsolation}
                    onChange={(event) => {
                      handleUpdateInstanceConfig(
                        "specGameConfig.versionIsolation",
                        event.target.checked
                      );
                      // updateSummaryInContext("isVersionIsolated", event.target.checked)
                    }}
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
      <VStack overflow="auto" align="stretch" spacing={4} flex="1">
        {instanceSpecSettingsGroups.map((group, index) => (
          <OptionItemGroup
            title={group.title}
            items={group.items}
            key={index}
          />
        ))}
        {!useSpecGameConfig && (
          <Text className="secondary-text" fontSize="xs-sm" textAlign="center">
            <Trans
              i18nKey="InstanceSettingsPage.tipsToGlobal.content"
              components={{
                terms: (
                  <Link
                    color={`${primaryColor}.500`}
                    onClick={() => {
                      router.push("/settings/global-game");
                    }}
                  />
                ),
              }}
            />
          </Text>
        )}
      </VStack>
      <Box h={4} />
      <Collapse in={useSpecGameConfig} animateOpacity>
        {useSpecGameConfig && instanceGameConfig && (
          <GameSettingsGroups
            gameConfig={instanceGameConfig}
            updateGameConfig={(key: string, value: any) => {
              handleUpdateInstanceConfig(`specGameConfig.${key}`, value);
            }}
          />
        )}
      </Collapse>
    </Box>
  );
};

export default InstanceSettingsPage;

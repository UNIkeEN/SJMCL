import { HStack, Tag, TagLabel, VStack } from "@chakra-ui/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuX } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { UtilsService } from "@/services/utils";

interface ServiceStatus {
  loading: boolean;
  latency?: number;
  error: boolean;
}

const PingTestPage = () => {
  const { t } = useTranslation();

  const [servicesStatus, setServicesStatus] = useState<
    Record<string, ServiceStatus>
  >({});

  const services = useMemo(
    () =>
      [
        {
          bmclapi: "https://bmclapi2.bangbang93.com",
        },
        {
          curseforge: "https://www.curseforge.com/minecraft",
          modrinth: "https://modrinth.com",
        },
        {
          mojang: "https://api.mojang.com",
          forge: "https://files.minecraftforge.net",
          fabric: "https://meta.fabricmc.net",
          neoforge: "https://maven.neoforged.net",
          authlibInjector: "https://authlib-injector.yushi.moe",
        },
        {
          github: "https://www.github.com",
          sjmclapi: "https://mc.sjtu.cn/api-sjmcl",
        },
      ] as Record<string, string>[],
    []
  );

  const handleCheckServiceAvailability = useCallback(
    async (serviceId: string, url: string) => {
      setServicesStatus((prev) => ({
        ...prev,
        [serviceId]: { loading: true, error: false },
      }));

      const res = await UtilsService.checkServiceAvailability(url);

      if (res.status === "success") {
        setServicesStatus((prev) => ({
          ...prev,
          [serviceId]: {
            loading: false,
            latency: res.data ?? 0,
            error: false,
          },
        }));
      } else {
        setServicesStatus((prev) => ({
          ...prev,
          [serviceId]: { loading: false, error: true },
        }));
      }
    },
    []
  );

  const checkAllServices = useCallback(async () => {
    const allEntries = services.flatMap((group) => Object.entries(group)); // [ [id, url], ... ]

    setServicesStatus((prev) => {
      const newStatus = { ...prev };
      allEntries.forEach(([id]) => {
        newStatus[id] = { loading: true, error: false };
      });
      return newStatus;
    });

    try {
      await Promise.allSettled(
        allEntries.map(([id, url]) => handleCheckServiceAvailability(id, url))
      );
    } catch (error) {
      logger.error(error);
    }
  }, [handleCheckServiceAvailability, services]);

  useEffect(() => {
    const initialCheck = async () => {
      await checkAllServices();
    };
    initialCheck();
  }, [checkAllServices]);

  return (
    <Section
      title={t("PingTestPage.PingServerList.title")}
      withBackButton
      headExtra={
        <CommonIconButton
          icon="refresh"
          onClick={checkAllServices}
          size="xs"
          fontSize="sm"
          h={21}
          isLoading={Object.values(servicesStatus).some((s) => s.loading)}
        />
      }
    >
      <VStack align="stretch" spacing={4}>
        {services.map((group, groupIdx) => (
          <OptionItemGroup
            key={groupIdx}
            items={Object.entries(group).map(([id, url]) => {
              const status = servicesStatus[id] || { loading: true };

              return {
                title: t(`PingTestPage.PingServerList.${id}`),
                description: url,
                children: status.loading ? (
                  <BeatLoader size={6} color="grey" />
                ) : (
                  <Tag
                    colorScheme={
                      status.error
                        ? "red"
                        : (status.latency || 0) < 200
                          ? "green"
                          : "yellow"
                    }
                  >
                    <HStack spacing={0.5}>
                      {status.error ? (
                        <>
                          <LuX />
                          <TagLabel>
                            {t("PingTestPage.PingServerList.offline")}
                          </TagLabel>
                        </>
                      ) : (
                        <>
                          <LuCheck />
                          <TagLabel>{status.latency}</TagLabel>
                          <TagLabel>ms</TagLabel>
                        </>
                      )}
                    </HStack>
                  </Tag>
                ),
              };
            })}
          />
        ))}
      </VStack>
    </Section>
  );
};

export default PingTestPage;

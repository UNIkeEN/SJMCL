import { VStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import ComingSoon from "@/components/coming-soon";
import { Section } from "@/components/common/section";

export const MinecraftNewsPage = () => {
  const { t } = useTranslation();

  return (
    <Section title={t("DiscoverLayout.discoverDomainList.minecraft-news")}>
      <VStack align="stretch" spacing={4}>
        <ComingSoon />
      </VStack>
    </Section>
  );
};

export default MinecraftNewsPage;

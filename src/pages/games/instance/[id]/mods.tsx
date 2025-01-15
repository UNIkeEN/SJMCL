import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { Section } from "@/components/common/section";
import ModLoaderCards from "@/components/mod-loader-cards";
import { useInstanceSharedData } from "@/contexts/instance";

const InstanceModsPage = () => {
  const { t } = useTranslation();
  const { summary } = useInstanceSharedData();

  return (
    <>
      <Section title={t("InstanceModsPage.modLoaderList.title")} isAccordion>
        <ModLoaderCards
          installedType={summary?.modLoader.type || "none"}
          installedVersion={summary?.modLoader.version}
        />
      </Section>
      <Section
        title={t("InstanceModsPage.modList.title")}
        isAccordion
      ></Section>
    </>
  );
};

export default InstanceModsPage;

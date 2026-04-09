import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Section } from "@/components/common/section";
import ExtensionPageRenderer from "@/components/extension/extension-page-renderer";
import { useExtensionHost } from "@/contexts/extension/host";

const ExtensionSettingsDetailPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { identifier } = router.query;
  const { extensionList } = useExtensionHost();

  const extensionIdentifier =
    typeof identifier === "string" ? identifier : undefined;
  const extension = extensionList?.find(
    (item) => item.identifier === extensionIdentifier
  );

  return (
    <Section
      title={t("ExtensionSettingsDetailPage.title", {
        name: extension?.name || extensionIdentifier || "Extension",
      })}
      withBackButton
      backRoutePath="/settings/extension"
    >
      <ExtensionPageRenderer mode="settings" />
    </Section>
  );
};

export default ExtensionSettingsDetailPage;

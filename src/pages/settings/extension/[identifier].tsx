import { useRouter } from "next/router";
import Empty from "@/components/common/empty";
import { Section } from "@/components/common/section";
import ExtensionContributionWrapper from "@/components/extension/contribution-wrapper";
import { useExtensionHost } from "@/contexts/extension";

const ExtensionSettingsDetailPage = () => {
  const router = useRouter();
  const { identifier } = router.query;
  const { extensionList, getExtensionList, getExtensionSettingsPage } =
    useExtensionHost();

  const extensionIdentifier =
    typeof identifier === "string" ? identifier : undefined;
  const extension =
    extensionList?.find((item) => item.identifier === extensionIdentifier) ||
    getExtensionList()?.find((item) => item.identifier === extensionIdentifier);
  const settingsPage = extensionIdentifier
    ? getExtensionSettingsPage(extensionIdentifier)
    : undefined;

  if (!extension || !settingsPage) {
    return <Empty withIcon={false} size="sm" />;
  }

  const SettingsComponent = settingsPage.Component;

  return (
    <Section
      title={extension.name}
      titleExtra={settingsPage.extension.identifier}
      withBackButton
      backRoutePath="/settings/extension"
    >
      <ExtensionContributionWrapper resetKey={settingsPage.resetKey}>
        <SettingsComponent />
      </ExtensionContributionWrapper>
    </Section>
  );
};

export default ExtensionSettingsDetailPage;

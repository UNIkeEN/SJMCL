import { useRouter } from "next/router";
import Empty from "@/components/common/empty";
import ExtensionContributionWrapper from "@/components/extension/contribution-wrapper";
import {
  normalizeExtensionRelativePath,
  useExtensionHost,
} from "@/contexts/extension";

interface ExtensionPageRendererProps {
  mode: "general" | "settings";
  isStandAlone?: boolean;
}

const ExtensionPageRenderer = ({
  mode,
  isStandAlone = false,
}: ExtensionPageRendererProps) => {
  const router = useRouter();
  const { identifier, routePath } = router.query;

  const { extensionList, getExtensionPage, getExtensionSettingsPage } =
    useExtensionHost();

  const extensionIdentifier =
    typeof identifier === "string" ? identifier : undefined;
  const normalizedRoutePath = normalizeExtensionRelativePath(routePath);
  const extension = extensionList?.find(
    (item) => item.identifier === extensionIdentifier
  );

  const contribution =
    mode === "settings"
      ? extensionIdentifier
        ? getExtensionSettingsPage(extensionIdentifier)
        : undefined
      : extensionIdentifier && normalizedRoutePath
        ? getExtensionPage(
            extensionIdentifier,
            normalizedRoutePath,
            isStandAlone
          )
        : undefined;

  if (!extension || !contribution) {
    return <Empty withIcon={false} size="sm" />;
  }

  const ContributionComponent = contribution.Component;

  return (
    <ExtensionContributionWrapper resetKey={contribution.resetKey}>
      <ContributionComponent />
    </ExtensionContributionWrapper>
  );
};

export default ExtensionPageRenderer;

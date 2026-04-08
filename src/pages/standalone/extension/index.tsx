import ExtensionPageRenderer from "@/components/extension/extension-page-renderer";

// In the standalone mode, we pass identifier and routePath as query parameters, due to Next.js's export limitations.
const StandaloneExtensionCustomPage = () => {
  return <ExtensionPageRenderer mode="general" isStandAlone />;
};

export default StandaloneExtensionCustomPage;

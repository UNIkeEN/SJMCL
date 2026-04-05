import { Text } from "@chakra-ui/react";
import { t } from "i18next";
import React from "react";

interface ExtensionContributionBoundaryProps {
  children: React.ReactNode;
  resetKey?: string;
}

interface ExtensionContributionBoundaryState {
  hasError: boolean;
}

class ExtensionContributionBoundary extends React.Component<
  ExtensionContributionBoundaryProps,
  ExtensionContributionBoundaryState
> {
  constructor(props: ExtensionContributionBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    logger.error("Extension contribution render failed", error);
  }

  componentDidUpdate(prevProps: ExtensionContributionBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Text fontSize="xs" className="secondary-text">
          {t("ExtensionContributionWrapper.failedToRender")}
        </Text>
      );
    }
    return this.props.children;
  }
}

interface ExtensionContributionWrapperProps {
  children: React.ReactNode;
  resetKey?: string;
}

const ExtensionContributionWrapper = ({
  children,
  resetKey,
}: ExtensionContributionWrapperProps) => {
  return (
    <ExtensionContributionBoundary resetKey={resetKey}>
      {children}
    </ExtensionContributionBoundary>
  );
};

export default ExtensionContributionWrapper;

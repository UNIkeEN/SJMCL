import {
  Alert,
  AlertIcon,
  Button,
  HStack,
  Image,
  Link,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Text,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { exit } from "@tauri-apps/plugin-process";
import { Trans, useTranslation } from "react-i18next";
import { LuLanguages } from "react-icons/lu";
import LanguageMenu from "@/components/language-menu";
import { useGuidedTour } from "@/components/special/guided-tour-provider";
import { useLauncherConfig } from "@/contexts/config";

const WelcomeAndTermsModal: React.FC<Omit<ModalProps, "children">> = ({
  ...props
}) => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { startGuidedTour } = useGuidedTour();

  const handleAgree = () => {
    update("runCount", config.runCount + 1);
    props.onClose();
    startGuidedTour();
  };

  // Map build_type to an unstable-version label for the warning alert.
  // release builds get no warning; the rest reuse General.version.<label>.
  const buildTypeToLabel: Record<string, string> = {
    dev: "dev",
    nightly: "nightly",
    "test-build": "test-build",
  };
  const launcherVersion = config.basicInfo.launcherVersion;
  const matchedVersionLabel =
    buildTypeToLabel[config.basicInfo.buildType] ??
    (launcherVersion.includes("beta") ? "beta" : undefined);

  const isWinArm64 =
    config.basicInfo.platform === "windows" &&
    config.basicInfo.arch === "aarch64";

  return (
    <Modal
      autoFocus={false}
      closeOnEsc={false}
      closeOnOverlayClick={false}
      size={{ base: "sm", lg: "md" }}
      returnFocusOnClose={false}
      {...props}
    >
      <ModalOverlay />
      <ModalContent borderRadius="md" overflow="hidden">
        <Image alt="banner" src="/images/banner.png" />
        <ModalHeader>
          🎉&nbsp;&nbsp;{t("WelcomeAndTermsModal.header.title")}
        </ModalHeader>
        <ModalBody mt={-1}>
          <Text color="gray.500">
            <Trans
              i18nKey="WelcomeAndTermsModal.body.text"
              components={{
                terms: (
                  <Link
                    color={`${primaryColor}.500`}
                    onClick={() => {
                      openUrl(
                        t(
                          "AboutSettingsPage.legalInfo.settings.userAgreement.url"
                        )
                      );
                    }}
                  />
                ),
              }}
            />
          </Text>
          {matchedVersionLabel && (
            <Alert status="warning" mt={3} fontSize="xs-sm" borderRadius="md">
              <AlertIcon />
              {t("WelcomeAndTermsModal.warning.unstableVersion", {
                versionLabel: t(`General.version.${matchedVersionLabel}`),
              })}
            </Alert>
          )}
          {isWinArm64 && (
            <Alert status="info" mt={3} fontSize="xs-sm" borderRadius="md">
              <AlertIcon />
              <Text>
                <Trans
                  i18nKey="WelcomeAndTermsModal.warning.winArm64Notice"
                  components={{
                    b: <b />,
                    glpack: (
                      <Link
                        color={`${primaryColor}.500`}
                        onClick={() => {
                          openUrl(
                            "ms-windows-store://pdp/?productid=9NQPSL29BFFF"
                          );
                        }}
                      />
                    ),
                  }}
                />
              </Text>
            </Alert>
          )}
        </ModalBody>
        <ModalFooter w="100%">
          <HStack spacing={2}>
            <LuLanguages />
            <LanguageMenu placement="top" />
          </HStack>
          <HStack spacing={3} ml="auto">
            <Button variant="ghost" onClick={() => exit(0)}>
              {t("General.exit")}
            </Button>
            <Button colorScheme={primaryColor} onClick={handleAgree}>
              {t("WelcomeAndTermsModal.button.agree")}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default WelcomeAndTermsModal;

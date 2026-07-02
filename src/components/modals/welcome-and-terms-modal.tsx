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
import { BuildType } from "@/enums/misc";

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

  // For non-release builds, use the build type as the version label for the warning alert.
  // release builds get no warning; the rest reuse General.version.<label>.
  const matchedUnstableVersionLabel =
    config.basicInfo.buildType !== BuildType.Release
      ? config.basicInfo.buildType
      : config.basicInfo.launcherVersion.startsWith("0.") ||
          config.basicInfo.launcherVersion.includes("beta")
        ? BuildType.Beta
        : undefined;

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
          {matchedUnstableVersionLabel && (
            <Alert status="warning" mt={3} fontSize="xs-sm" borderRadius="md">
              <AlertIcon />
              {t("WelcomeAndTermsModal.warning.unstableVersion", {
                versionLabel: t(
                  `General.version.${matchedUnstableVersionLabel}`
                ),
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

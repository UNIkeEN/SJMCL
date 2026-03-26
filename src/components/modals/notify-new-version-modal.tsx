import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { LuExternalLink } from "react-icons/lu";
import MarkdownContainer from "@/components/common/markdown-container";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { VersionMetaInfo } from "@/models/config";
import { ConfigService } from "@/services/config";

interface NotifyNewVersionModalProps extends Omit<ModalProps, "children"> {
  newVersion: VersionMetaInfo;
}

const NotifyNewVersionModal: React.FC<NotifyNewVersionModalProps> = ({
  newVersion,
  ...props
}) => {
  const toast = useToast();
  const router = useRouter();
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  const isLinux = config.basicInfo.osType === "linux"; // for Linux, navigate to the website.

  const handleDownloadUpdate = () => {
    if (isLinux) {
      const lang = config.general.general.language === "zh-Hans" ? "zh" : "en";
      openUrl(`https://mc.sjtu.cn/sjmcl/${lang}`);
    } else {
      ConfigService.downloadLauncherUpdate(newVersion).then((response) => {
        if (response.status !== "success") {
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
          return;
        } else {
          router.push("/downloads");
        }
      });
    }
    props.onClose();
  };

  const processReleaseNotes = (raw: string): string => {
    const m = raw.match(
      /^([\s\S]*?)- ([\s\S]*?)(?:\r?\n)?\s*-{3,}\s*\r?\n([\s\S]*)$/
    ); // match MD separator

    // If user language is Chinese, swap to make Chinese part on top.
    const isZh = config.general.general.language.startsWith("zh");
    return m && isZh
      ? `${m[1].trim()}\n${m[3].trim()}\n---\n- ${m[2].trim()}`
      : raw;
  };

  return (
    <Modal scrollBehavior="inside" size="xl" {...props}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{`${t("NotifyNewVersionModal.title")} - ${newVersion.version}`}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <MarkdownContainer>
            {processReleaseNotes(newVersion.releaseNotes || "")}
          </MarkdownContainer>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={props.onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            variant="solid"
            colorScheme={primaryColor}
            rightIcon={isLinux ? <LuExternalLink /> : undefined}
            onClick={handleDownloadUpdate}
          >
            {t("General.download")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default NotifyNewVersionModal;

import {
  Button,
  Grid,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuExternalLink } from "react-icons/lu";
import { useLauncherConfig } from "@/contexts/config";

export const DownloadJavaModal: React.FC<Omit<ModalProps, "children">> = ({
  ...props
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const os = config.basicInfo.osType;
  const arch = config.basicInfo.arch;

  const [vendor, setVendor] = useState<"zulu" | "oracle" | "">("");
  const [version, setVersion] = useState<"" | "8" | "11" | "17" | "21">("");
  const [type, setType] = useState<"" | "jdk" | "jre">("");

  const mapArchToUrlParam = (arch: string): string | undefined => {
    switch (arch) {
      case "x86_64":
        return "x86-64-bit";
      case "aarch64":
        return "arm-64-bit";
      default:
        return undefined;
    }
  };

  const handleConfirm = () => {
    let url = "";

    if (vendor === "zulu") {
      const archParam = mapArchToUrlParam(arch);
      const archQuery = archParam ? `&architecture=${archParam}` : "";
      url = `https://www.azul.com/downloads/?version=java-${version}-lts&os=${os}${archQuery}&package=${type}&show-old-builds=true#zulu`;
    } else if (vendor === "oracle") {
      const javaOrJdk =
        version === "8" || version === "11" || version === "17"
          ? "java"
          : "jdk";
      url = `https://www.oracle.com/java/technologies/downloads/#${javaOrJdk}${version}-${os.replace("macos", "mac")}`;
    }

    openUrl(url);
    props.onClose?.();
  };

  return (
    <Modal size={{ base: "sm", lg: "md" }} {...props}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("DownloadJavaModal.header.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch">
            <Grid templateColumns="1fr 1fr 1fr" gap={4} w="100%">
              <Select
                placeholder={t("DownloadJavaModal.selector.vendor")}
                value={vendor}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setVendor(val);
                  if (val === "oracle") setType("jdk");
                }}
                size="sm"
              >
                <option value="zulu">Zulu</option>
                <option value="oracle">Oracle</option>
              </Select>

              <Select
                placeholder={t("DownloadJavaModal.selector.version")}
                value={version}
                onChange={(e) => setVersion(e.target.value as any)}
                size="sm"
              >
                <option value="8">8</option>
                <option value="11">11</option>
                <option value="17">17</option>
                <option value="21">21</option>
              </Select>

              <Select
                placeholder={t("DownloadJavaModal.selector.type")}
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                size="sm"
              >
                <option value="jdk">JDK</option>
                {vendor !== "oracle" && <option value="jre">JRE</option>}
              </Select>
            </Grid>

            {vendor === "oracle" && (
              <Text color="gray.500">{t("DownloadJavaModal.warning")}</Text>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={props.onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            colorScheme={primaryColor}
            rightIcon={<LuExternalLink />}
            isDisabled={!(vendor && version && type)}
            onClick={handleConfirm}
          >
            {t("General.confirm")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

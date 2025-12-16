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
  Text,
  VStack,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRouter } from "next/router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuExternalLink } from "react-icons/lu";
import { MenuSelector } from "@/components/common/menu-selector";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { ConfigService } from "@/services/config";

type VendorKey = "mojang" | "zulu" | "bellsoft" | "oracle";

interface JavaVendor {
  label: string;
  hasJre: boolean;
  archMap: Record<string, string>;
  versions?: string[];
  getUrl: (params: {
    version: string;
    os: string;
    archParam: string;
    type: "jdk" | "jre";
  }) => string;
}

const buildDownloadUrl = (baseUrl: string, params: Record<string, string>) => {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
};

export const DownloadJavaModal: React.FC<Omit<ModalProps, "children">> = ({
  ...props
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const toast = useToast();
  const router = useRouter();
  const primaryColor = config.appearance.theme.primaryColor;
  const os = config.basicInfo.osType;
  const arch = config.basicInfo.arch;

  const [vendor, setVendor] = useState<VendorKey | "">("");
  const [version, setVersion] = useState<"" | "8" | "11" | "17" | "21">("");
  const [type, setType] = useState<"" | "jdk" | "jre">("");

  const VENDORS: Record<VendorKey, JavaVendor> = {
    mojang: {
      label: "Mojang",
      hasJre: true,
      archMap: { x86_64: "x64", aarch64: "arm64" },
      versions: [...(os === "macos" ? [] : ["8"]), "17", "21", "25"],
      getUrl: () => "",
    },
    zulu: {
      label: "Zulu",
      hasJre: true,
      archMap: {
        x86_64: "x86-64-bit",
        aarch64: "arm-64-bit",
      },
      getUrl: ({ version, os, archParam, type }) => {
        return (
          buildDownloadUrl("https://www.azul.com/downloads/", {
            version: `java-${version}-lts`,
            os,
            architecture: archParam,
            package: type,
            "show-old-builds": "true",
          }) + "#zulu"
        );
      },
    },
    bellsoft: {
      label: "BellSoft",
      hasJre: true,
      archMap: {
        x86_64: "x86",
        aarch64: "arm",
      },
      getUrl: ({ version, os, archParam, type }) => {
        return buildDownloadUrl("https://bell-sw.com/pages/downloads/", {
          version: `java-${version}`,
          os,
          package: type,
          architecture: archParam,
        });
      },
    },
    oracle: {
      label: "Oracle",
      hasJre: false,
      archMap: {},
      getUrl: ({ version, os }) => {
        const javaOrJdk = ["8", "11", "17"].includes(version) ? "java" : "jdk";
        return `https://www.oracle.com/java/technologies/downloads/#${javaOrJdk}${version}-${os.replace("macos", "mac")}`;
      },
    },
  };

  const handleConfirm = async () => {
    if (!vendor || !version || !type) return;

    if (vendor === "mojang") {
      ConfigService.downloadMojangJava(version).then((res) => {
        if (res.status === "success") {
          router.push("/downloads");
          props.onClose?.();
        } else {
          toast({
            title: res.message,
            status: "error",
          });
        }
      });
    } else {
      const selectedVendor = VENDORS[vendor as VendorKey];
      const archParam = selectedVendor.archMap[arch] || "";
      const url = selectedVendor.getUrl({
        version,
        os,
        archParam,
        type: type as "jdk" | "jre",
      });
      openUrl(url);
    }
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
              <MenuSelector
                options={Object.entries(VENDORS).map(([key, val]) => ({
                  value: key,
                  label: val.label,
                }))}
                value={vendor}
                onSelect={(val) => {
                  const selected = val as VendorKey;
                  if (!VENDORS[selected].hasJre) {
                    setType("jdk");
                  } else if (selected === "mojang") {
                    setType("jre");
                  }
                  if (
                    VENDORS[selected]?.versions &&
                    !VENDORS[selected].versions.includes(version)
                  ) {
                    setVersion("");
                  }
                  setVendor(selected);
                }}
                placeholder={t("DownloadJavaModal.selector.vendor")}
                size="sm"
                fontSize="sm"
              />

              <MenuSelector
                options={
                  VENDORS[vendor as VendorKey]?.versions || [
                    "8",
                    "11",
                    "17",
                    "21",
                    "25",
                  ]
                }
                value={version}
                onSelect={(val) => setVersion(val as typeof version)}
                placeholder={t("DownloadJavaModal.selector.version")}
                size="sm"
                fontSize="sm"
              />

              <MenuSelector
                options={[
                  { value: "jdk", label: "JDK" },
                  ...(vendor && VENDORS[vendor as VendorKey]?.hasJre
                    ? [{ value: "jre", label: "JRE" }]
                    : []),
                ]}
                disabled={vendor === "mojang"}
                value={type}
                onSelect={(val) => setType(val as typeof type)}
                placeholder={t("DownloadJavaModal.selector.type")}
                size="sm"
                fontSize="sm"
              />
            </Grid>

            {["mojang", "oracle"].includes(vendor) && (
              <Text color="gray.500">
                {t(`DownloadJavaModal.warning.${vendor}`)}
              </Text>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={props.onClose}>
            {t("General.cancel")}
          </Button>
          <Button
            colorScheme={primaryColor}
            rightIcon={vendor !== "mojang" ? <LuExternalLink /> : undefined}
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

import { writeImage, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { t } from "i18next";

interface CopyOptions {
  toast: (options: { title: string; status: "success" | "error" }) => void;
}

export const copyText = async (text: string, { toast }: CopyOptions) => {
  try {
    await writeText(text);
    toast({
      title: t("General.copy.toast.success"),
      status: "success",
    });
    return true;
  } catch (error) {
    console.error("Copy failed:", error);
    toast({
      title: t("General.copy.toast.error"),
      status: "error",
    });
    return false;
  }
};

export const copyImage = async (base64Data: string, { toast }: CopyOptions) => {
  try {
    await writeImage(base64Data);
    toast({
      title: t("General.copy.toast.success"),
      status: "success",
    });
    return true;
  } catch (error) {
    console.error("Copy image failed:", error);
    toast({
      title: t("General.copy.toast.success"),
      status: "error",
    });
    return false;
  }
};

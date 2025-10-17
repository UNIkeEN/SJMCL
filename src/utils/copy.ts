import { Image } from "@tauri-apps/api/image";
import { writeImage, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { t } from "i18next";

interface ToastOptions {
  toast: (options: { title: string; status: "success" | "error" }) => void;
}

export const copyText = async (text: string, { toast }: ToastOptions) => {
  try {
    await writeText(text);
    toast({
      title: t("General.copy.toast.success"),
      status: "success",
    });
    return true;
  } catch (error) {
    logger.error("Copy failed:", error);
    toast({
      title: t("General.copy.toast.error"),
      status: "error",
    });
    return false;
  }
};

// NOT TESTED
export const copyImage = async (
  img: string | Image | Uint8Array | ArrayBuffer | number[],
  { toast }: ToastOptions
) => {
  try {
    await writeImage(img);
    toast({
      title: t("General.copy.toast.success"),
      status: "success",
    });
    return true;
  } catch (error) {
    logger.error("Copy image failed:", error);
    toast({
      title: t("General.copy.toast.error"),
      status: "error",
    });
    return false;
  }
};

// NOT TESTED
export const copyImageFromElement = async (
  imgEl: HTMLImageElement,
  { toast }: ToastOptions
) => {
  const canvas = document.createElement("canvas");
  canvas.width = imgEl.naturalWidth;
  canvas.height = imgEl.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  else {
    ctx.drawImage(imgEl, 0, 0);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png")
    );
    const arrayBuffer = await blob.arrayBuffer();
    copyImage(Array.from(new Uint8Array(arrayBuffer)), { toast });
    return true;
  }
};

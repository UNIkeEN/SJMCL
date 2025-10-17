import { readFile } from "@tauri-apps/plugin-fs";
import { t } from "i18next";

interface ToastOptions {
  toast: (options: { title: string; status: "success" | "error" }) => void;
}

export async function shareFile(
  path: string,
  mime: string,
  title: string,
  { toast }: ToastOptions,
  text?: string
) {
  const bytes = await readFile(path);

  const name = path.split("/").pop() ?? "shared-file";
  const blob = new Blob([bytes], { type: mime });
  const file = new File([blob], name, { type: mime });

  // use navigator.share
  try {
    // @ts-ignore
    if (navigator.canShare && !(navigator as any).canShare({ files: [file] })) {
      throw new Error("Cannot share this file");
    }

    await (navigator as any).share({
      files: [file],
      title,
      text,
    });
    // toast({
    //   title: t("General.share.toast.success"),
    //   status: "success",
    // });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      // user cancelled the share action
      return;
    }
    logger.error("Share failed:", error);
    toast({
      title: t("General.share.toast.error"),
      status: "error",
    });
  }
}

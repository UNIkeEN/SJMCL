import { useEffect } from "react";
import { useLauncherConfig } from "@/contexts/config";

interface ShortcutCondition {
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  key?: string;
  code?: string;
}

const useKeyboardShortcut = (
  shortcutConditions: { all?: ShortcutCondition } & {
    [key: string]: ShortcutCondition;
  },
  callback: () => void
) => {
  const { config } = useLauncherConfig();
  useEffect(() => {
    const activeShortcut =
      shortcutConditions[config.basicInfo.osType] || shortcutConditions.all;
    if (!activeShortcut) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const {
        metaKey = false, // "Win" on Windows and "Command" on macOS
        ctrlKey = false,
        altKey = false,
        shiftKey = false,
        key,
        code,
      } = activeShortcut;

      const isMetaKey = metaKey === event.metaKey;
      const isCtrlKey = ctrlKey === event.ctrlKey;
      const isAltKey = altKey === event.altKey;
      const isShiftKey = shiftKey === event.shiftKey;
      const isKey = key ? event.key.toLowerCase() === key.toLowerCase() : true;
      const isCode = code ? event.code === code : true;

      if (isMetaKey && isCtrlKey && isAltKey && isShiftKey && isKey && isCode) {
        callback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcutConditions, callback, config.basicInfo.osType]);
};

export default useKeyboardShortcut;

import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import micromatch from "micromatch";
import { useEffect, useRef } from "react";

const SJMCL_LINK_PREFIX = "sjmcl://";
const EMIT_DEEPLINK_EVENT = "deeplink:emit";

type TriggerRule = string | string[] | RegExp | ((subpath: string) => boolean);

interface UseDeepLinkOptions {
  trigger: TriggerRule;
  onCall: (path: string, subpath: string) => void;
}

// Do not use openUrl so this helper can be used during development.
export const emitDeepLink = (urls: string[]) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<string[]>(EMIT_DEEPLINK_EVENT, {
      detail: urls,
    })
  );
};

export const useDeepLink = ({ trigger, onCall }: UseDeepLinkOptions) => {
  const didInit = useRef(false);
  const unlistenRef = useRef<() => void>();

  useEffect(() => {
    function matchSubpath(path: string, rule: TriggerRule): boolean {
      if (typeof rule === "string" || Array.isArray(rule)) {
        return micromatch.isMatch(path, rule);
      } else if (rule instanceof RegExp) {
        return rule.test(path);
      } else if (typeof rule === "function") {
        return rule(path);
      }
      return false;
    }

    const handleUrls = (urls: string[]) => {
      urls.forEach((url) => {
        if (url.startsWith(SJMCL_LINK_PREFIX)) {
          const subpath = url.slice(SJMCL_LINK_PREFIX.length);
          if (matchSubpath(subpath, trigger)) {
            onCall(url, subpath);
          }
        }
      });
    };

    const handleDevUrls = (event: Event) => {
      const customEvent = event as CustomEvent<string[]>;
      handleUrls(customEvent.detail || []);
    };

    const setup = async () => {
      if (!didInit.current) {
        didInit.current = true;

        try {
          const currentUrls = await getCurrent(); // check deeplink if app is launched through deeplink
          if (currentUrls) {
            handleUrls(currentUrls);
          }
        } catch (err) {
          logger.error("getCurrent failed:", err);
        }
      }

      try {
        unlistenRef.current = await onOpenUrl(handleUrls); // listen for deeplink when app is running
      } catch (err) {
        logger.error("Failed to listen to deep links:", err);
      }
    };

    window.addEventListener(EMIT_DEEPLINK_EVENT, handleDevUrls);
    setup();

    return () => {
      window.removeEventListener(EMIT_DEEPLINK_EVENT, handleDevUrls);
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, [trigger, onCall]);
};

export default useDeepLink;

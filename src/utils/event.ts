import { getCurrentWebview } from "@tauri-apps/api/webview";

// Fix the "undefined is not an object (evaluating 'listeners[eventId].handlerId')" error, which is caused by improper cleanup of Tauri event listeners throughout the app.
// ref: https://github.com/UNIkeEN/SJMCL/issues/667
// ref: https://github.com/arach/scout/blob/61e247ea7f63204730ef86da14e149d51e4cfb1b/EVENT_LISTENER_FIX_SUMMARY.md
export function safeListen<T>(
  event: string,
  handler: (event: { payload: T }) => void
): () => void {
  let cleanup: () => void = () => {};

  getCurrentWebview()
    .listen<T>(event, handler)
    .then((unlisten) => {
      cleanup = () => {
        try {
          unlisten();
        } catch (err) {
          console.warn(`Error cleaning up listener for ${event}:`, err);
        }
      };
    })
    .catch((error) => {
      console.error(`Failed to set up listener for ${event}:`, error);
    });

  return () => {
    cleanup(); // may be a no-op at first
  };
}

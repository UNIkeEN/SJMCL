import { getCurrentWebview } from "@tauri-apps/api/webview";

/**
 * Safe wrapper for Tauri event listeners that prevents "handlerId" errors.
 *
 * This utility addresses the issue where event listeners fail to clean up properly,
 * causing "Cannot read properties of undefined (reading 'handlerId')" errors
 * and subsequent frontend refreshes.
 */

/**
 * Safely listen to a Tauri event with proper error handling.
 * @param eventName - The name of the event to listen to
 * @param callback - The callback function to execute when the event is received
 * @returns A cleanup function that can be safely called multiple times
 */
export async function safeEventListen<T>(
  eventName: string,
  callback: (payload: T) => void
): Promise<() => void> {
  try {
    const unlisten = await getCurrentWebview().listen<T>(eventName, (event) => {
      try {
        callback(event.payload);
      } catch (error) {
        console.error(`Error in event callback for ${eventName}:`, error);
      }
    });

    // Return a safe cleanup function
    return () => {
      try {
        unlisten();
      } catch (error) {
        // Silently ignore cleanup errors to prevent crashes
        console.debug(`Event listener cleanup failed for ${eventName}:`, error);
      }
    };
  } catch (error) {
    console.error(`Failed to setup event listener for ${eventName}:`, error);
    // Return a no-op cleanup function if setup fails
    return () => {};
  }
}

/**
 * Creates a safe event listener that returns a promise-based cleanup function.
 * This is compatible with the existing pattern used in the services.
 * @param eventName - The name of the event to listen to
 * @param callback - The callback function to execute when the event is received
 * @returns A cleanup function that returns a promise
 */
export function createSafeEventListener<T>(
  eventName: string,
  callback: (payload: T) => void
): () => void {
  let cleanup: (() => void) | null = null;

  // Setup the listener asynchronously
  safeEventListen(eventName, callback)
    .then((unlistenFn) => {
      cleanup = unlistenFn;
    })
    .catch((error) => {
      console.error(
        `Failed to create safe event listener for ${eventName}:`,
        error
      );
    });

  // Return a cleanup function that safely calls the unlisten function
  return () => {
    if (cleanup) {
      try {
        cleanup();
      } catch (error) {
        console.debug(`Event listener cleanup failed for ${eventName}:`, error);
      }
    }
  };
}

/**
 * Safely clean up multiple event listeners.
 * @param cleanupFunctions - Array of cleanup functions to execute
 */
export function cleanupListeners(cleanupFunctions: (() => void)[]): void {
  cleanupFunctions.forEach((cleanup, index) => {
    try {
      cleanup();
    } catch (error) {
      console.debug(`Failed to cleanup listener ${index}:`, error);
    }
  });
}

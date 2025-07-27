import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

export const REFRESH_RESOURCE_LIST_EVENT = "instance:refresh-resource-list";

/**
 * Hook to listen for resource download completion events and refresh the resource list
 * @param resourceTypes - Array of resource types to listen for (e.g., ['mod', 'resourcepack'])
 * @param refreshCallback - Function to call when any of the specified resource types are downloaded
 */
export const useResourceRefresh = (
  resourceTypes: string[],
  refreshCallback: () => void
) => {
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen<{ resourceType: string }>(
        REFRESH_RESOURCE_LIST_EVENT,
        (event) => {
          const { resourceType } = event.payload;
          // Refresh if the downloaded resource type matches any of our target types
          if (resourceTypes.includes(resourceType)) {
            refreshCallback();
          }
        }
      );

      return unlisten;
    };

    let unlistenPromise = setupListener();

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [resourceTypes, refreshCallback]);
};

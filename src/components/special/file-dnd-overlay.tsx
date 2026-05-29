import { Box, Center, Flex, Icon, Text, VStack } from "@chakra-ui/react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { IconType } from "react-icons";
import { LuFileUp } from "react-icons/lu";

export type FileDnDRegistry = {
  extensions: string[];
  titleKey?: string;
  descKey?: string;
  icon?: IconType;
  multiple?: boolean;
  onDrop: (paths: string[]) => void | Promise<void>;
};

type Entry = { id: symbol; registries: FileDnDRegistry[] };
type IndexedItem = { registry: FileDnDRegistry; order: number };
type MatchItem = {
  registry: FileDnDRegistry;
  paths: string[];
  fileName: string;
  order: number;
};

const FileDnDContext = createContext<null | {
  upsert: (id: symbol, registries: FileDnDRegistry | FileDnDRegistry[]) => void;
  remove: (id: symbol) => void;
}>(null);

const getFileInfo = (path: string) => {
  const fileName = path.split(/[\\/]/).pop() || path;
  const dotIndex = fileName.lastIndexOf(".");
  return {
    fileName,
    extension: dotIndex < 0 ? "" : fileName.slice(dotIndex + 1).toLowerCase(),
  };
};

const rebuildRegistryIndex = (entries: Entry[]) => {
  const index = new Map<string, IndexedItem[]>();
  let order = 0;

  for (const entry of entries) {
    for (const registry of entry.registries) {
      for (const extension of registry.extensions) {
        const key = extension.trim().toLowerCase();
        if (!key) continue;
        const items = index.get(key);
        const item = { registry, order: order++ };
        if (items) items.push(item);
        else index.set(key, [item]);
      }
    }
  }

  return index;
};

const getMatches = (
  paths: string[],
  registryIndex: Map<string, IndexedItem[]>
) => {
  const matches = new Map<FileDnDRegistry, MatchItem>();

  for (const path of paths) {
    const { fileName, extension } = getFileInfo(path);
    const items = registryIndex.get(extension);
    if (!items) continue;

    for (const item of items) {
      const current = matches.get(item.registry);
      if (current) {
        if (current.order >= item.order) {
          if (item.registry.multiple) current.paths.push(path);
          continue;
        }

        if (item.registry.multiple) {
          current.paths.push(path);
          current.fileName = fileName;
          current.order = item.order;
          continue;
        }
      }
      matches.set(item.registry, {
        registry: item.registry,
        paths: [path],
        fileName,
        order: item.order,
      });
    }
  }

  return Array.from(matches.values()).sort((a, b) => a.order - b.order);
};

// support multiple handler, calc match by cursor position
const getMatchIndex = (count: number, positionX: number) => {
  if (count <= 1) return 0;
  const totalWidth = Math.max(window.innerWidth, 1);
  const clampedX = Math.min(Math.max(positionX, 0), totalWidth - 1);
  return Math.min(count - 1, Math.floor((clampedX / totalWidth) * count));
};

export const useFileDnD = (registries: FileDnDRegistry | FileDnDRegistry[]) => {
  const context = useContext(FileDnDContext);
  const idRef = useRef(Symbol("file-dnd"));

  useEffect(() => {
    if (!context) return;
    // Keep the latest registration synced with the provider.
    context.upsert(idRef.current, registries);
  }, [context, registries]);

  useEffect(() => {
    if (!context) return;
    const id = idRef.current;
    return () => context.remove(id);
  }, [context]);
};

export const FileDnDProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const [dragState, setDragState] = useState<{
    paths: string[];
    positionX: number;
  } | null>(null);
  const entriesRef = useRef<Entry[]>([]);
  const registryIndexRef = useRef<Map<string, IndexedItem[]>>(new Map());
  const unlistenRef = useRef<(() => void) | null>(null);

  // The provider maintains a list of registered handlers and their derived extension index for lookup.
  const upsert = useCallback(
    (id: symbol, registries: FileDnDRegistry | FileDnDRegistry[]) => {
      const next = Array.isArray(registries) ? registries : [registries];
      const current = entriesRef.current.find((item) => item.id === id);
      if (current) current.registries = next;
      else entriesRef.current.push({ id, registries: next });
      // Rebuild the extension lookup after every registry change.
      registryIndexRef.current = rebuildRegistryIndex(entriesRef.current);
    },
    []
  );

  const remove = useCallback((id: symbol) => {
    entriesRef.current = entriesRef.current.filter((item) => item.id !== id);
    registryIndexRef.current = rebuildRegistryIndex(entriesRef.current);
  }, []);

  const matches = dragState
    ? getMatches(dragState.paths, registryIndexRef.current)
    : [];
  const activeIndex = dragState
    ? getMatchIndex(matches.length, dragState.positionX)
    : -1;
  const activeMatch = activeIndex >= 0 ? matches[activeIndex] : null;

  // Listen to drag-drop events from the webview.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        const payload = event.payload;

        if (payload.type === "leave") {
          setDragState(null);
          return;
        }

        if (payload.type === "over") {
          setDragState((current) =>
            current
              ? {
                  ...current,
                  positionX: payload.position.x,
                }
              : current
          );
          return;
        }

        if (payload.type !== "enter" && payload.type !== "drop") {
          return;
        }

        if (payload.type === "enter") {
          // Store incoming paths so the overlay can reflect the active handler.
          setDragState({
            paths: payload.paths,
            positionX: payload.position.x,
          });
          return;
        }

        const dropMatches = getMatches(payload.paths, registryIndexRef.current);
        const match =
          dropMatches[getMatchIndex(dropMatches.length, payload.position.x)];
        setDragState(null);
        if (!match) return;

        const handleDrop = match.registry.onDrop(
          match.registry.multiple ? match.paths : [match.paths[0]]
        );
        Promise.resolve(handleDrop).catch((error) => {
          logger.error("Failed to handle dropped files:", error);
        });
      });

      if (cancelled) {
        unlisten();
        return;
      }

      unlistenRef.current = unlisten;
    })().catch((error) => {
      logger.error("Failed to listen to drag-drop events:", error);
    });

    return () => {
      cancelled = true;
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, []);

  const isMultiMatch = matches.length > 1;
  const displayMatches = isMultiMatch
    ? matches
    : activeMatch
      ? [activeMatch]
      : [];

  const overlayItems = displayMatches.map((match) => {
    const fileNameText =
      match.paths.length > 1
        ? t("FileDnDProvider.fileName", {
            fileName: match.fileName,
            count: match.paths.length,
          })
        : match.fileName;

    return {
      ...match,
      title: match.registry.titleKey
        ? t(match.registry.titleKey, { fileName: match.fileName })
        : t("General.import"),
      desc: match.registry.descKey
        ? t(match.registry.descKey, { fileName: fileNameText })
        : "",
      icon: match.registry.icon || LuFileUp,
    };
  });

  return (
    <FileDnDContext.Provider value={{ upsert, remove }}>
      {children}
      {activeMatch && (
        <>
          <Box
            position="absolute"
            inset={0}
            zIndex={1700} // higher than 1400 (Modal), same as toast
            pointerEvents="none"
            bg="blackAlpha.600"
            backdropFilter="blur(10px)"
          />
          <Box
            position="absolute"
            inset={4}
            zIndex={1701}
            pointerEvents="none"
            borderRadius="md"
            borderWidth="2px"
            borderStyle="dashed"
            borderColor="whiteAlpha.600"
            overflow="hidden"
          >
            <Flex w="100%" h="100%">
              {overlayItems.map((match, index) => {
                return (
                  <Center
                    key={`${match.order}:${index}`}
                    flex="1"
                    px={6}
                    bg={
                      // multiple matches will show in a row, highlight the active one
                      isMultiMatch && index === activeIndex
                        ? "whiteAlpha.300"
                        : "transparent"
                    }
                  >
                    <VStack spacing={2} color="white" textAlign="center">
                      <Icon as={match.icon} boxSize={10} />
                      <Text fontSize="lg" fontWeight="500">
                        {match.title}
                      </Text>
                      {match.desc && <Text fontSize="sm">{match.desc}</Text>}
                    </VStack>
                  </Center>
                );
              })}
            </Flex>
          </Box>
        </>
      )}
    </FileDnDContext.Provider>
  );
};

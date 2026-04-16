import { Box, VStack } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HomeWidget from "@/components/extension/home-widget";
import { useLauncherConfig } from "@/contexts/config";
import { useExtensionHost } from "@/contexts/extension/host";
import {
  ExtensionHomeWidgetContribution,
  type HomeWidgetStateTuple,
} from "@/models/extension";
import { areArraysEqual, clamp } from "@/utils/math";

interface HomeWidgetContainerProps {
  maxWidth: number;
}

interface WidthBounds {
  lower: number;
  upper: number;
}

const DEFAULT_WIDGET_WIDTH = 300;

const areHomeWidgetStatesEqual = (
  left: HomeWidgetStateTuple[],
  right: HomeWidgetStateTuple[]
) => {
  return areArraysEqual(
    left,
    right,
    (
      [leftIdentifier, leftWidth, leftCollapsed],
      [rightIdentifier, rightWidth, rightCollapsed]
    ) =>
      leftIdentifier === rightIdentifier &&
      leftWidth === rightWidth &&
      leftCollapsed === rightCollapsed
  );
};

const HomeWidgetContainer = ({ maxWidth }: HomeWidgetContainerProps) => {
  const { config, update } = useLauncherConfig();
  const { homeWidgets } = useExtensionHost();
  const persistedState = config.extension.homeWidgetState;

  const widgetsByIdentifier = useMemo(() => {
    return new Map(homeWidgets.map((widget) => [widget.identifier, widget]));
  }, [homeWidgets]);

  const visibleWidgetIdentifiers = useMemo(
    () => homeWidgets.map((widget) => widget.identifier),
    [homeWidgets]
  );

  const persistedStateMap = useMemo(() => {
    return new Map(
      persistedState.map(([identifier, width, collapsed]) => [
        identifier,
        { width, collapsed },
      ])
    );
  }, [persistedState]);

  const [widgetOrder, setWidgetOrder] = useState<string[]>([]);
  const [widgetWidthMap, setWidgetWidthMap] = useState<Record<string, number>>(
    {}
  );
  const [widgetCollapsedMap, setWidgetCollapsedMap] = useState<
    Record<string, boolean>
  >({});
  const [isHydrated, setIsHydrated] = useState(false);

  const widgetOrderRef = useRef<string[]>([]);
  const widgetWidthMapRef = useRef<Record<string, number>>({});
  const widgetCollapsedMapRef = useRef<Record<string, boolean>>({});
  const persistHomeWidgetStateRef = useRef<() => void>(() => undefined);
  const startupPersistTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    widgetOrderRef.current = widgetOrder;
  }, [widgetOrder]);

  useEffect(() => {
    widgetWidthMapRef.current = widgetWidthMap;
  }, [widgetWidthMap]);

  useEffect(() => {
    widgetCollapsedMapRef.current = widgetCollapsedMap;
  }, [widgetCollapsedMap]);

  useEffect(() => {
    if (visibleWidgetIdentifiers.length === 0) {
      setWidgetOrder([]);
      setWidgetWidthMap({});
      setWidgetCollapsedMap({});
      setIsHydrated(false);
      return;
    }

    const visibleWidgetSet = new Set(visibleWidgetIdentifiers);
    const nextOrder: string[] = [];
    const seenIdentifiers = new Set<string>();

    for (const [identifier] of persistedState) {
      if (
        visibleWidgetSet.has(identifier) &&
        !seenIdentifiers.has(identifier)
      ) {
        nextOrder.push(identifier);
        seenIdentifiers.add(identifier);
      }
    }

    for (const identifier of visibleWidgetIdentifiers) {
      if (!seenIdentifiers.has(identifier)) {
        nextOrder.push(identifier);
        seenIdentifiers.add(identifier);
      }
    }

    const nextWidthMap = Object.fromEntries(
      homeWidgets.map((widget) => [
        widget.identifier,
        persistedStateMap.get(widget.identifier)?.width ??
          widget.defaultWidth ??
          DEFAULT_WIDGET_WIDTH,
      ])
    );
    const nextCollapsedMap = Object.fromEntries(
      homeWidgets.map((widget) => [
        widget.identifier,
        persistedStateMap.get(widget.identifier)?.collapsed ?? false,
      ])
    );

    setWidgetOrder((prev) =>
      areArraysEqual(prev, nextOrder) ? prev : nextOrder
    );
    setWidgetWidthMap(nextWidthMap);
    setWidgetCollapsedMap(nextCollapsedMap);
    setIsHydrated(true);
  }, [
    homeWidgets,
    persistedState,
    persistedStateMap,
    visibleWidgetIdentifiers,
  ]);

  const getWidgetWidthBounds = useCallback(
    (widget: ExtensionHomeWidgetContribution): WidthBounds => {
      const lower = Math.max(0, widget.minWidth ?? 0);
      const upper = Math.max(
        lower,
        Math.min(maxWidth, widget.maxWidth ?? Number.POSITIVE_INFINITY)
      );
      return { lower, upper };
    },
    [maxWidth]
  );

  const orderedWidgetIdentifiers = useMemo(() => {
    const orderedIdentifiers = widgetOrder.filter((identifier) =>
      widgetsByIdentifier.has(identifier)
    );
    const missingIdentifiers = visibleWidgetIdentifiers.filter(
      (identifier) => !orderedIdentifiers.includes(identifier)
    );

    return [...orderedIdentifiers, ...missingIdentifiers];
  }, [visibleWidgetIdentifiers, widgetOrder, widgetsByIdentifier]);

  // Merge current UI state with hidden widgets so launcher config can fully restore the layout.
  const persistHomeWidgetState = useCallback(
    (
      nextOrder = widgetOrderRef.current,
      nextWidthMap = widgetWidthMapRef.current,
      nextCollapsedMap = widgetCollapsedMapRef.current
    ) => {
      const normalizedOrder = [
        ...nextOrder.filter((identifier) =>
          widgetsByIdentifier.has(identifier)
        ),
        ...visibleWidgetIdentifiers.filter(
          (identifier) => !nextOrder.includes(identifier)
        ),
      ];
      const visibleWidgetSet = new Set(visibleWidgetIdentifiers);

      const nextVisibleState = normalizedOrder
        .map((identifier) => widgetsByIdentifier.get(identifier))
        .filter((widget) => !!widget)
        .map((widget) => {
          const bounds = getWidgetWidthBounds(widget);
          const preferredWidth =
            nextWidthMap[widget.identifier] ??
            widget.defaultWidth ??
            DEFAULT_WIDGET_WIDTH;
          const width = Math.round(
            clamp(preferredWidth, bounds.lower, bounds.upper)
          );

          return [
            widget.identifier,
            width,
            !!nextCollapsedMap[widget.identifier],
          ] as HomeWidgetStateTuple;
        });

      const hiddenState = persistedState.filter(
        ([identifier]) => !visibleWidgetSet.has(identifier)
      );
      const nextState = [...nextVisibleState, ...hiddenState];

      if (!areHomeWidgetStatesEqual(persistedState, nextState)) {
        update("extension.homeWidgetState", nextState);
      }
    },
    [
      getWidgetWidthBounds,
      persistedState,
      update,
      visibleWidgetIdentifiers,
      widgetsByIdentifier,
    ]
  );

  useEffect(() => {
    persistHomeWidgetStateRef.current = persistHomeWidgetState;
  }, [persistHomeWidgetState]);

  const widgetLayouts = useMemo(() => {
    return orderedWidgetIdentifiers
      .map((identifier) => widgetsByIdentifier.get(identifier))
      .filter((widget) => !!widget)
      .map((widget) => {
        const bounds = getWidgetWidthBounds(widget);
        const preferredWidth =
          widgetWidthMap[widget.identifier] ??
          widget.defaultWidth ??
          DEFAULT_WIDGET_WIDTH;
        const width = clamp(preferredWidth, bounds.lower, bounds.upper);

        return {
          widget,
          bounds,
          width,
        };
      });
  }, [
    getWidgetWidthBounds,
    orderedWidgetIdentifiers,
    widgetWidthMap,
    widgetsByIdentifier,
  ]);

  const handleWidgetWidthChange = useCallback(
    (widgetIdentifier: string, width: number) => {
      setWidgetWidthMap((prev) => {
        if (prev[widgetIdentifier] === width) return prev;

        return {
          ...prev,
          [widgetIdentifier]: width,
        };
      });
    },
    []
  );

  // Commit the final width on mouse up so drag updates don't spam config writes.
  const handleWidgetWidthCommit = useCallback(
    (widgetIdentifier: string, width: number) => {
      const nextWidthMap = {
        ...widgetWidthMapRef.current,
        [widgetIdentifier]: width,
      };
      setWidgetWidthMap(nextWidthMap);
      persistHomeWidgetState(undefined, nextWidthMap);
    },
    [persistHomeWidgetState]
  );

  // Persist collapsed state immediately because this action is discrete and cheap to save.
  const handleWidgetCollapsedChange = useCallback(
    (widgetIdentifier: string, collapsed: boolean) => {
      const nextCollapsedMap = {
        ...widgetCollapsedMapRef.current,
        [widgetIdentifier]: collapsed,
      };
      setWidgetCollapsedMap(nextCollapsedMap);
      persistHomeWidgetState(undefined, undefined, nextCollapsedMap);
    },
    [persistHomeWidgetState]
  );

  const handleMoveWidgetUp = useCallback(
    (widgetIdentifier: string) => {
      const currentOrder = [...orderedWidgetIdentifiers];
      const currentIndex = currentOrder.indexOf(widgetIdentifier);
      if (currentIndex <= 0) return;

      [currentOrder[currentIndex - 1], currentOrder[currentIndex]] = [
        currentOrder[currentIndex],
        currentOrder[currentIndex - 1],
      ];

      setWidgetOrder(currentOrder);
      persistHomeWidgetState(currentOrder);
    },
    [orderedWidgetIdentifiers, persistHomeWidgetState]
  );

  useEffect(() => {
    if (!isHydrated || orderedWidgetIdentifiers.length === 0) return;

    if (startupPersistTimerRef.current) {
      clearTimeout(startupPersistTimerRef.current);
    }

    startupPersistTimerRef.current = setTimeout(() => {
      persistHomeWidgetStateRef.current();
    }, 1500);

    return () => {
      if (startupPersistTimerRef.current) {
        clearTimeout(startupPersistTimerRef.current);
        startupPersistTimerRef.current = undefined;
      }
    };
  }, [isHydrated, orderedWidgetIdentifiers]);

  const containerWidth = useMemo(
    () => Math.max(0, ...widgetLayouts.map((layout) => layout.width)),
    [widgetLayouts]
  );

  const topWidgetIdentifier = orderedWidgetIdentifiers[0];

  if (homeWidgets.length === 0) return null;

  return (
    <Box
      flexShrink={0}
      w={`${containerWidth}px`}
      minW={0}
      minH={0}
      h="100%"
      maxH="100%"
      overflow="hidden"
      position="relative"
    >
      <Box
        position="absolute"
        inset={0}
        overflowY="auto"
        overflowX="hidden"
        className="no-scrollbar"
      >
        <VStack align="start" spacing={4}>
          {widgetLayouts.map(({ widget, bounds, width }) => (
            <HomeWidget
              key={widget.resetKey}
              widget={widget}
              width={width}
              widthBounds={bounds}
              onWidthChange={(nextWidth) =>
                handleWidgetWidthChange(widget.identifier, nextWidth)
              }
              onWidthCommit={(nextWidth) =>
                handleWidgetWidthCommit(widget.identifier, nextWidth)
              }
              isCollapsed={!!widgetCollapsedMap[widget.identifier]}
              onCollapsedChange={(collapsed) =>
                handleWidgetCollapsedChange(widget.identifier, collapsed)
              }
              showMoveUpButton={widget.identifier !== topWidgetIdentifier}
              onMoveUp={() => handleMoveWidgetUp(widget.identifier)}
            />
          ))}
        </VStack>
      </Box>
    </Box>
  );
};

export default HomeWidgetContainer;

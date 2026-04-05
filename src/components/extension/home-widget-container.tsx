import { Box, VStack } from "@chakra-ui/react";
import { useCallback, useMemo, useState } from "react";
import HomeWidget from "@/components/extension/home-widget";
import { useExtensionHost } from "@/contexts/extension";
import { ExtensionHomeWidgetContribution } from "@/models/extension";
import { clamp } from "@/utils/math";

interface HomeWidgetContainerProps {
  maxWidth: number;
}

interface WidthBounds {
  lower: number;
  upper: number;
}

const DEFAULT_WIDGET_WIDTH = 300;

const HomeWidgetContainer = ({ maxWidth }: HomeWidgetContainerProps) => {
  const { homeWidgets } = useExtensionHost();
  const widgets = homeWidgets;

  const [widgetWidthMap, setWidgetWidthMap] = useState<Record<string, number>>(
    {}
  );

  // calculate each widget's width bound by its declaration and container's current max width.
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

  const widgetLayouts = useMemo(
    () =>
      widgets.map((widget) => {
        const bounds = getWidgetWidthBounds(widget);
        const preferredWidth =
          widgetWidthMap[widget.identifier] ??
          widget.defaultWidth ??
          DEFAULT_WIDGET_WIDTH;
        const width = clamp(preferredWidth, bounds.lower, bounds.upper);

        return { widget, bounds, width };
      }),
    [getWidgetWidthBounds, widgetWidthMap, widgets]
  );

  const handleWidgetWidthChange = useCallback(
    (identifier: string, width: number) => {
      setWidgetWidthMap((prev) => {
        if (prev[identifier] === width) return prev;
        return {
          ...prev,
          [identifier]: width,
        };
      });
    },
    []
  );

  const containerWidth = useMemo(
    () => Math.max(0, ...widgetLayouts.map((layout) => layout.width)),
    [widgetLayouts]
  );

  if (widgets.length === 0) return null;

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
        <VStack align="start" spacing={4} pr="10px">
          {widgetLayouts.map(({ widget, bounds, width }) => (
            <HomeWidget
              key={widget.identifier}
              widget={widget}
              width={width}
              widthBounds={bounds}
              onWidthChange={(nextWidth) =>
                handleWidgetWidthChange(widget.identifier, nextWidth)
              }
            />
          ))}
        </VStack>
      </Box>
    </Box>
  );
};

export default HomeWidgetContainer;

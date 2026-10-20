import { useMediaQuery } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useId, useRef, useState } from "react";
import { useLauncherConfig } from "@/contexts/config";
import styles from "@/styles/liquid-glass.module.css";

type LiquidGlassEffectProps = {
  isDark?: boolean;
};

// A resized or moved card can also change the positions of other glass layers.
const layoutUpdates = new Set<() => void>();
let layoutFrame = 0;

const scheduleLayoutUpdate = () => {
  if (layoutFrame || !layoutUpdates.size) return;
  layoutFrame = requestAnimationFrame(() => {
    layoutFrame = 0;
    layoutUpdates.forEach((update) => update());
  });
};

// Smooth displacement inspired by rdev/liquid-glass-react/src/shader-utils.ts.
// https://github.com/rdev/liquid-glass-react
const createDisplacementMap = (
  width: number,
  height: number,
  radius: number
) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return "";

  const pixels = context.createImageData(width, height);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const bevel = Math.min(16, radius || 16, halfWidth, halfHeight);
  const rimWidth = Math.ceil(Math.max(radius, bevel));

  for (let y = 0; y < height; y++) {
    const py = y + 0.5 - halfHeight;
    const qy = Math.abs(py) - (halfHeight - radius);
    const oy = Math.max(qy, 0);
    const isMiddleRow = y >= rimWidth && y < height - rimWidth;

    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      pixels.data[offset] = 128;
      pixels.data[offset + 1] = 128;
      pixels.data[offset + 2] = 128;
      pixels.data[offset + 3] = 255;
      // The flat center only needs the neutral displacement value.
      if (isMiddleRow && x >= rimWidth && x < width - rimWidth) continue;

      const px = x + 0.5 - halfWidth;
      const qx = Math.abs(px) - (halfWidth - radius);
      const ox = Math.max(qx, 0);
      const length = Math.hypot(ox, oy);
      const distance = length + Math.min(Math.max(qx, qy), 0) - radius;
      const nx = length ? ox / length : Number(qx > qy);
      const ny = length ? oy / length : Number(qy >= qx);
      const depth = Math.max(0, -distance);
      const rim = Math.max(0, 1 - depth / bevel);
      // Ease displacement to zero at the silhouette. Keep alpha opaque:
      // fading the image produces a double edge.
      const edge = Math.min(1, depth / 2);
      const feather = edge * edge * (3 - 2 * edge);
      // Two smoothstep passes ease the rim into the flat center.
      const smooth = rim * rim * (3 - 2 * rim);
      const bend = smooth * smooth * (3 - 2 * smooth) * feather * 0.22;
      pixels.data[offset] = Math.round((0.5 - Math.sign(px) * nx * bend) * 255);
      pixels.data[offset + 1] = Math.round(
        (0.5 - Math.sign(py) * ny * bend) * 255
      );
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL();
};

interface LiquidGlassLayerProps {
  enabled: boolean;
  bgImageSrc: string;
  isBgDarken: boolean;
}

// Keep measurement state here so painting a layer does not invalidate layout.
const LiquidGlassLayer = ({
  enabled,
  bgImageSrc,
  isBgDarken,
}: LiquidGlassLayerProps) => {
  const id = `glass-${useId().replace(/:/g, "")}`;
  const layerRef = useRef<HTMLDivElement>(null);

  const [map, setMap] = useState("");
  const [bounds, setBounds] = useState({
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  });

  useEffect(() => {
    if (!enabled) return;
    const layer = layerRef.current!;
    const card = layer.parentElement!;
    let previousSize = "";

    const update = () => {
      const rect = layer.getBoundingClientRect();
      // Keep the map in local coordinates when an ancestor is scaled.
      const width = layer.offsetWidth;
      const height = layer.offsetHeight;
      const nextBounds = {
        width,
        height,
        x: -rect.left,
        y: -rect.top,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
      setBounds((previous) =>
        previous.width === nextBounds.width &&
        previous.height === nextBounds.height &&
        previous.x === nextBounds.x &&
        previous.y === nextBounds.y &&
        previous.viewportWidth === nextBounds.viewportWidth &&
        previous.viewportHeight === nextBounds.viewportHeight
          ? previous
          : nextBounds
      );
      const radius = Math.min(
        parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0,
        width / 2,
        height / 2
      );
      const size = `${width}:${height}:${radius}`;
      if (!width || !height || size === previousSize) return;
      previousSize = size;
      setMap(createDisplacementMap(width, height, radius));
    };
    const handleScroll = (event: Event) => {
      if (event.target instanceof Node && event.target.contains(card)) {
        scheduleLayoutUpdate();
      }
    };
    const handleTransition = (event: TransitionEvent) => {
      // Paint-only transitions cannot change the wallpaper's alignment.
      if (/(color|shadow)$|^opacity$/.test(event.propertyName)) return;
      scheduleLayoutUpdate();
    };
    const observer = new ResizeObserver(scheduleLayoutUpdate);
    observer.observe(card);
    layoutUpdates.add(update);
    scheduleLayoutUpdate();
    if (layoutUpdates.size === 1) {
      window.addEventListener("resize", scheduleLayoutUpdate);
      document.addEventListener("animationend", scheduleLayoutUpdate, true);
      document.addEventListener("animationcancel", scheduleLayoutUpdate, true);
    }
    document.addEventListener("scroll", handleScroll, true);
    document.addEventListener("transitionend", handleTransition, true);
    document.addEventListener("transitioncancel", handleTransition, true);
    return () => {
      observer.disconnect();
      layoutUpdates.delete(update);
      document.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("transitionend", handleTransition, true);
      document.removeEventListener("transitioncancel", handleTransition, true);
      if (layoutUpdates.size) {
        scheduleLayoutUpdate();
      } else {
        cancelAnimationFrame(layoutFrame);
        layoutFrame = 0;
        window.removeEventListener("resize", scheduleLayoutUpdate);
        document.removeEventListener(
          "animationend",
          scheduleLayoutUpdate,
          true
        );
        document.removeEventListener(
          "animationcancel",
          scheduleLayoutUpdate,
          true
        );
      }
    };
  }, [enabled]);

  return (
    <div
      ref={layerRef}
      className={styles.effect}
      data-wallpaper={Boolean(enabled && map)}
      aria-hidden="true"
    >
      {enabled && map && (
        <svg className={styles.refraction} width="100%" height="100%">
          <defs>
            <filter
              id={id}
              filterUnits="userSpaceOnUse"
              x="-32"
              y="-32"
              width={bounds.width + 64}
              height={bounds.height + 64}
              colorInterpolationFilters="sRGB"
            >
              <feImage
                href={map}
                x="0"
                y="0"
                width={bounds.width}
                height={bounds.height}
                preserveAspectRatio="none"
                result="rim"
              />
              {/* Blur one continuous source before bending it; no clear rim
                  over a separately frosted center. */}
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="2"
                edgeMode="duplicate"
                result="frosted"
              />
              <feColorMatrix
                in="frosted"
                type="saturate"
                values="1.4"
                result="material"
              />
              <feDisplacementMap
                in="material"
                in2="rim"
                scale="48"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
          <g filter={`url(#${id})`}>
            <image
              href={bgImageSrc}
              x={bounds.x}
              y={bounds.y}
              width={bounds.viewportWidth}
              height={bounds.viewportHeight}
              preserveAspectRatio="xMidYMid slice"
            />
            {isBgDarken && (
              <rect
                width={bounds.width}
                height={bounds.height}
                fill="black"
                fillOpacity="0.45"
              />
            )}
          </g>
        </svg>
      )}
    </div>
  );
};

// Filter a painted copy of the wallpaper: WebKit cannot displace a backdrop.
const LiquidGlassEffect = ({ isDark = false }: LiquidGlassEffectProps) => {
  const { bgImageSrc, isBgDarken } = useLauncherConfig();
  const router = useRouter();
  const [reduceTransparency] = useMediaQuery(
    "(prefers-reduced-transparency: reduce)",
    { fallback: true }
  );
  const hasWallpaper =
    !router.pathname.startsWith("/standalone") && Boolean(bgImageSrc);

  // Parent renders can move a card without resizing it, for example on sorting.
  useEffect(() => {
    scheduleLayoutUpdate();
  });

  return (
    <>
      <LiquidGlassLayer
        enabled={hasWallpaper && !reduceTransparency}
        bgImageSrc={bgImageSrc}
        isBgDarken={isBgDarken}
      />
      <div
        className={styles.shine}
        data-theme={isDark ? "dark" : undefined}
        aria-hidden="true"
      />
    </>
  );
};

export default LiquidGlassEffect;

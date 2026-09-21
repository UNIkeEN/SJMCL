import { useRouter } from "next/router";
import { useEffect, useId, useRef, useState } from "react";
import { useLauncherConfig } from "@/contexts/config";
import styles from "@/styles/liquid-glass.module.css";

// Smooth displacement inspired by rdev/liquid-glass-react/src/shader-utils.ts.
// https://github.com/rdev/liquid-glass-react
// Filter a painted copy of the wallpaper: WebKit cannot displace a backdrop.
const LiquidGlassEffect = () => {
  const id = `glass-${useId().replace(/:/g, "")}`;
  const layerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState("");
  const { bgImageSrc, isBgDarken } = useLauncherConfig();
  const router = useRouter();
  const hasWallpaper =
    !router.pathname.startsWith("/standalone") && Boolean(bgImageSrc);
  const [bounds, setBounds] = useState({
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    viewportWidth: 0,
    viewportHeight: 0,
  });

  useEffect(() => {
    const layer = layerRef.current;
    const card = layer?.parentElement;
    if (!layer || !card) return;
    let frame = 0;
    let previousSize = "";

    const update = () => {
      frame = 0;
      const rect = layer.getBoundingClientRect();
      const nextBounds = {
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        x: -rect.left,
        y: -rect.top,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
      setBounds((previous) =>
        Object.keys(nextBounds).every(
          (key) =>
            previous[key as keyof typeof previous] ===
            nextBounds[key as keyof typeof nextBounds]
        )
          ? previous
          : nextBounds
      );
      const width = Math.ceil(rect.width);
      const height = Math.ceil(rect.height);
      const radius = Math.min(
        parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0,
        width / 2,
        height / 2
      );
      const bevel = Math.min(16, radius || 16, width / 2, height / 2);
      const size = `${width}:${height}:${radius}`;
      if (!width || !height || size === previousSize) return;
      previousSize = size;

      // One CSS pixel per texel, generated only when the card geometry changes.
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return;
      const pixels = context.createImageData(width, height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const px = x + 0.5 - width / 2;
          const py = y + 0.5 - height / 2;
          const qx = Math.abs(px) - (width / 2 - radius);
          const qy = Math.abs(py) - (height / 2 - radius);
          const ox = Math.max(qx, 0);
          const oy = Math.max(qy, 0);
          const length = Math.hypot(ox, oy);
          const distance = length + Math.min(Math.max(qx, qy), 0) - radius;
          const nx = length ? ox / length : Number(qx > qy);
          const ny = length ? oy / length : Number(qy >= qx);
          // A narrow curved rim; the center remains optically flat.
          const depth = Math.max(0, -distance);
          const rim = Math.max(0, 1 - depth / bevel);
          // Ease displacement to zero at the silhouette, as in rdev's shader
          // mode. Keep alpha opaque: fading the image produces a double edge.
          const edge = Math.min(1, depth / 2);
          const feather = edge * edge * (3 - 2 * edge);
          // Two smoothstep passes ease the rim into the flat center.
          const smooth = rim * rim * (3 - 2 * rim);
          const bend = smooth * smooth * (3 - 2 * smooth) * feather * 0.22;
          const offset = (y * width + x) * 4;
          pixels.data[offset] = Math.round(
            (0.5 - Math.sign(px) * nx * bend) * 255
          );
          pixels.data[offset + 1] = Math.round(
            (0.5 - Math.sign(py) * ny * bend) * 255
          );
          pixels.data[offset + 2] = 128;
          pixels.data[offset + 3] = 255;
        }
      }
      context.putImageData(pixels, 0, 0);
      setMap(canvas.toDataURL());
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(card);
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    // Navigation cards can move after their width transition finishes.
    document.addEventListener("transitionend", schedule, true);
    update();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      document.removeEventListener("transitionend", schedule, true);
    };
  }, []);

  return (
    <>
      <div
        ref={layerRef}
        className={styles.effect}
        data-wallpaper={Boolean(hasWallpaper && map)}
        aria-hidden="true"
      >
        {hasWallpaper && map && (
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
      <div className={styles.shine} aria-hidden="true" />
    </>
  );
};

export default LiquidGlassEffect;

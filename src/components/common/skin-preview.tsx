import { Box, BoxProps } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import * as skinview3d from "skinview3d";

interface SkinPreviewProps extends BoxProps {
  skinUrl: string;
  capeUrl?: string;
  defaultWidth?: number;
  defaultHeight?: number;
}

const SkinPreview: React.FC<SkinPreviewProps> = ({
  skinUrl,
  capeUrl,
  defaultWidth = 400,
  defaultHeight = 500,
  width,
  height,
  ...rest
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const widthAsNumber =
    typeof width === "number" ? width : parseInt(width as string, 10);
  const heightAsNumber =
    typeof height === "number" ? height : parseInt(height as string, 10);

  const computedWidth =
    widthAsNumber ||
    (heightAsNumber
      ? (heightAsNumber * defaultWidth) / defaultHeight
      : defaultWidth);
  const computedHeight =
    heightAsNumber ||
    (widthAsNumber
      ? (widthAsNumber * defaultHeight) / defaultWidth
      : defaultHeight);

  useEffect(() => {
    if (canvasRef.current && skinUrl) {
      const skinViewer = new skinview3d.SkinViewer({
        canvas: canvasRef.current,
        width: computedWidth,
        height: computedHeight,
        skin: skinUrl,
      });

      skinViewer.autoRotate = true;

      if (capeUrl) {
        skinViewer.loadCape(capeUrl);
      }

      skinViewer.camera.position.set(0, 1, 3);
      skinViewer.camera.lookAt(0, 1, 0);

      return () => {
        skinViewer.dispose();
      };
    }
  }, [skinUrl, capeUrl, computedWidth, computedHeight]);

  return (
    <Box {...rest}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
        }}
      ></canvas>
    </Box>
  );
};

export default SkinPreview;

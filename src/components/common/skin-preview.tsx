import { useEffect, useRef } from "react";
import * as skinview3d from "skinview3d";

interface SkinPreviewProps {
  skinUrl: string;
  capeUrl?: string;
}

const SkinPreview: React.FC<SkinPreviewProps> = ({ skinUrl, capeUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current && skinUrl) {
      const skinViewer = new skinview3d.SkinViewer({
        canvas: canvasRef.current,
        width: 400,
        height: 500,
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
  }, [skinUrl, capeUrl]);

  return (
    <canvas ref={canvasRef} style={{ width: "100%", height: "auto" }}></canvas>
  );
};

export default SkinPreview;

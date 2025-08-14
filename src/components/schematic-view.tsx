import { Box, HStack, Icon, IconButton, Text, VStack } from "@chakra-ui/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEyeOff, LuRefreshCcw } from "react-icons/lu";

interface SchematicViewProps {
  fileUrl?: string;
  width?: string | number;
  height?: string | number;
}

declare global {
  interface Window {
    deepslate: any;
    glMatrix: any;
    loadDeepslateResources: any;
    readLitematicFromNBTData: any;
    structureFromLitematic: any;
    deepslateResources: any;
  }
}

const SchematicView: React.FC<SchematicViewProps> = ({
  fileUrl,
  width = "100%",
  height = "400px",
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rendererRef = useRef<any>(null);
  const cameraRef = useRef({
    pitch: 0.8,
    yaw: 0.5,
    pos: [0, 0, 0] as [number, number, number],
  });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const keysRef = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | null>(null);

  const updateCameraFromKeys = useCallback(() => {
    const camera = cameraRef.current;
    const moveSpeed = 0.2;

    const forward = [
      Math.sin(camera.yaw) * Math.cos(camera.pitch),
      Math.sin(camera.pitch),
      Math.cos(camera.yaw) * Math.cos(camera.pitch),
    ];

    const right = [Math.cos(camera.yaw), 0, -Math.sin(camera.yaw)];

    const up = [0, 1, 0];

    if (keysRef.current.has("KeyW") || keysRef.current.has("w")) {
      camera.pos[0] += forward[0] * moveSpeed;
      camera.pos[1] += forward[1] * moveSpeed;
      camera.pos[2] += forward[2] * moveSpeed;
    }
    if (keysRef.current.has("KeyS") || keysRef.current.has("s")) {
      camera.pos[0] -= forward[0] * moveSpeed;
      camera.pos[1] -= forward[1] * moveSpeed;
      camera.pos[2] -= forward[2] * moveSpeed;
    }
    if (keysRef.current.has("KeyD") || keysRef.current.has("d")) {
      camera.pos[0] -= right[0] * moveSpeed;
      camera.pos[1] -= right[1] * moveSpeed;
      camera.pos[2] -= right[2] * moveSpeed;
    }
    if (keysRef.current.has("KeyA") || keysRef.current.has("a")) {
      camera.pos[0] += right[0] * moveSpeed;
      camera.pos[1] += right[1] * moveSpeed;
      camera.pos[2] += right[2] * moveSpeed;
    }

    if (keysRef.current.has("Space") || keysRef.current.has(" ")) {
      camera.pos[0] -= up[0] * moveSpeed;
      camera.pos[1] -= up[1] * moveSpeed;
      camera.pos[2] -= up[2] * moveSpeed;
    }

    if (keysRef.current.has("ShiftLeft") || keysRef.current.has("ShiftRight")) {
      camera.pos[0] += up[0] * moveSpeed;
      camera.pos[1] += up[1] * moveSpeed;
      camera.pos[2] += up[2] * moveSpeed;
    }
  }, []);

  const render = useCallback(() => {
    if (!rendererRef.current || !canvasRef.current) return;

    updateCameraFromKeys();

    const { mat4 } = window.glMatrix;
    const camera = cameraRef.current;

    camera.yaw = camera.yaw % (Math.PI * 2);
    camera.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.pitch));

    const view = mat4.create();
    mat4.rotateX(view, view, camera.pitch);
    mat4.rotateY(view, view, camera.yaw);
    mat4.translate(view, view, camera.pos);

    rendererRef.current.drawStructure(view);
    rendererRef.current.drawGrid(view);

    animationFrameRef.current = requestAnimationFrame(render);
  }, [updateCameraFromKeys]);

  useEffect(() => {
    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
      });
    };

    const loadScripts = async () => {
      try {
        await loadScript("/litematic-viewer/resource/deepslate.js");
        await loadScript("/litematic-viewer/resource/gl-matrix-min.js");

        await loadScript("/litematic-viewer/resource/assets.js");
        await loadScript("/litematic-viewer/resource/opaque.js");
        await loadScript("/litematic-viewer/src/deepslate-helpers.js");
        await loadScript("/litematic-viewer/src/litematic-utils.js");
        await loadScript("/litematic-viewer/src/settings.js");
      } catch (err) {
        console.error("Failed to load required scripts:", err);
        setError("Failed to load viewer dependencies");
      }
    };

    loadScripts();
  }, []);

  useEffect(() => {
    const loadTextureAtlas = () => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        if (
          window.deepslate &&
          typeof window.loadDeepslateResources === "function"
        ) {
          window.loadDeepslateResources(image);
        }
      };
      image.onerror = () => {
        setError("Failed to load texture atlas");
      };
      image.src = "/litematic-viewer/resource/atlas.png";
    };

    const timer = setTimeout(loadTextureAtlas, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!fileUrl || !canvasRef.current || !window.deepslate) return;

    const loadSchematic = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const nbtData = window.deepslate.readNbt(new Uint8Array(arrayBuffer));

        if (!nbtData || !nbtData.value) {
          throw new Error("Invalid schematic file format");
        }

        const structureLitematic = window.readLitematicFromNBTData(nbtData);
        if (!structureLitematic) {
          throw new Error("Failed to parse litematic data");
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (!gl) {
          throw new Error("WebGL not supported");
        }

        const structure = window.structureFromLitematic(structureLitematic);
        rendererRef.current = new window.deepslate.StructureRenderer(
          gl,
          structure,
          window.deepslateResources,
          { chunkSize: 8 }
        );

        const size = structure.getSize();
        cameraRef.current = {
          pitch: 0.8,
          yaw: 0.5,
          pos: [-size[0] / 2, -size[1] / 2, -size[2] / 2],
        };

        render();
      } catch (err) {
        console.error("Error loading schematic:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    loadSchematic();
  }, [fileUrl, render]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["w", "a", "s", "d", "W", "A", "S", "D", " "].includes(e.key)) {
        e.preventDefault();
      }

      if (e.code) {
        keysRef.current.add(e.code);
      }

      const baseKey = e.key.toLowerCase();
      keysRef.current.add(baseKey);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code) {
        keysRef.current.delete(e.code);
      }

      keysRef.current.delete(e.key);
      keysRef.current.delete(e.key.toLowerCase());
      keysRef.current.delete(e.key.toUpperCase());
    };

    const handleBlur = () => {
      keysRef.current.clear();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        keysRef.current.clear();
      }
    };

    const cleanupInterval = setInterval(() => {
      const currentKeys = Array.from(keysRef.current);

      const keysToRemove = currentKeys.filter(
        (key) => /^[A-Z]$/.test(key) && key !== " "
      );
      keysToRemove.forEach((key) => keysRef.current.delete(key));
    }, 1000);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(cleanupInterval);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - lastMouseRef.current.x;
    const deltaY = e.clientY - lastMouseRef.current.y;

    cameraRef.current.yaw += deltaX * 0.01;
    cameraRef.current.pitch += deltaY * 0.01;

    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const camera = cameraRef.current;
    const zoomSpeed = 0.1;
    const forward = [
      Math.sin(camera.yaw) * Math.cos(camera.pitch),
      Math.sin(camera.pitch),
      Math.cos(camera.yaw) * Math.cos(camera.pitch),
    ];

    const zoomFactor = e.deltaY > 0 ? zoomSpeed : -zoomSpeed;
    camera.pos[0] += forward[0] * zoomFactor;
    camera.pos[1] += forward[1] * zoomFactor;
    camera.pos[2] += forward[2] * zoomFactor;
  };

  const resetView = () => {
    if (rendererRef.current) {
      try {
        const structure = rendererRef.current.structure;
        if (structure && typeof structure.getSize === "function") {
          const size = structure.getSize();
          cameraRef.current = {
            pitch: 0.8,
            yaw: 0.5,
            pos: [-size[0] / 2, -size[1] / 2, -size[2] / 2],
          };
        } else {
          cameraRef.current = {
            pitch: 0.8,
            yaw: 0.5,
            pos: [-10, -10, -10],
          };
        }
      } catch {
        cameraRef.current = {
          pitch: 0.8,
          yaw: 0.5,
          pos: [-10, -10, -10],
        };
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (gl) {
          gl.viewport(0, 0, canvas.width, canvas.height);
        }
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  if (error) {
    return (
      <Box
        width={width}
        height={height}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <VStack>
          <LuEyeOff size={48} color="gray" />
          <Text color="gray.500">{error}</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <VStack width={width} height={height} spacing={2}>
      <HStack width="100%" justify="space-between" px={2}>
        <HStack>
          <IconButton
            aria-label="refresh"
            icon={<Icon as={LuRefreshCcw} boxSize={3.5} />}
            onClick={resetView}
            size="xs"
            variant="ghost"
            colorScheme="gray"
          />
        </HStack>
        <VStack align="end" spacing={0}>
          <Text fontSize="sm" color="gray.500">
            {isLoading ? "Loading..." : "3D Viewer"}
          </Text>
        </VStack>
      </HStack>

      <Box
        ref={viewerRef}
        width="100%"
        height="100%"
        position="relative"
        bg="gray.50"
        borderRadius="md"
        overflow="hidden"
      >
        <canvas
          ref={canvasRef}
          width="100%"
          height="100%"
          tabIndex={0}
          style={{
            width: "100%",
            height: "100%",
            cursor: isDraggingRef.current ? "grabbing" : "grab",
            outline: "none",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onClick={() => canvasRef.current?.focus()}
        />

        {isLoading && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.700"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <VStack color="white">
              <Box
                width={8}
                height={8}
                border="2px solid"
                borderColor="white"
                borderTopColor="transparent"
                borderRadius="full"
                animation="spin 1s linear infinite"
              />
              <Text>Loading schematic...</Text>
            </VStack>
          </Box>
        )}
      </Box>
    </VStack>
  );
};

export default SchematicView;

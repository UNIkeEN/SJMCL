import { Box, HStack, Icon, IconButton, Text, VStack } from "@chakra-ui/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEyeOff, LuRefreshCcw } from "react-icons/lu";

interface SchematicViewProps {
  fileUrl?: string;
  width?: string | number;
  height?: string | number;
}

// Static imports for litematic viewer resources
declare global {
  interface Window {
    deepslate: any;
    glMatrix: any;
    loadDeepslateResources?: any;
    readLitematicFromNBTData?: any;
    structureFromLitematic?: any;
    deepslateResources?: any;
    assets?: any;
    OPAQUE_BLOCKS?: any;
    NON_SELF_CULLING?: any;
    TRANSPARENT_BLOCKS?: any;
  }
}

// Litematic utility classes and functions - ported from litematic-utils.js
class Litematic {
  regions: LitematicRegion[] = [];
}

class LitematicRegion {
  width: number;
  height: number;
  depth: number;
  blocks: any;
  blockPalette: any;

  constructor(width: number, height: number, depth: number) {
    this.width = width;
    this.height = height;
    this.depth = depth;
  }
}

// Utility functions ported from the litematic viewer
const upperPowerOfTwo = (x: number): number => {
  x -= 1;
  x |= x >> 1;
  x |= x >> 2;
  x |= x >> 4;
  x |= x >> 8;
  x |= x >> 16;
  x |= x >> 32;
  return x + 1;
};

const stripNBTTyping = (nbtData: any): any => {
  if (nbtData.hasOwnProperty("type")) {
    switch (nbtData.type) {
      case "compound":
        const newDict: any = {};
        for (const [k, v] of Object.entries(nbtData.value)) {
          newDict[k] = stripNBTTyping(v);
        }
        return newDict;
      case "list":
        const newList: any[] = [];
        for (const [k, v] of Object.entries(nbtData.value.value)) {
          newList[k as any] = stripNBTTyping(v);
        }
        return newList;
      default:
        return nbtData.value;
    }
  } else {
    switch (nbtData.constructor) {
      case Object:
        const newDict: any = {};
        for (const [k, v] of Object.entries(nbtData)) {
          newDict[k] = stripNBTTyping(v);
        }
        return newDict;
      default:
        return nbtData;
    }
  }
};

const processNBTRegionData = (
  regionData: any,
  nbits: number,
  width: number,
  height: number,
  depth: number
): any[][][] => {
  const mask = (1 << nbits) - 1;
  const y_shift = Math.abs(width * depth);
  const z_shift = Math.abs(width);

  const blocks: any[][][] = [];

  for (let x = 0; x < Math.abs(width); x++) {
    blocks[x] = [];
    for (let y = 0; y < Math.abs(height); y++) {
      blocks[x][y] = [];
      for (let z = 0; z < Math.abs(depth); z++) {
        const index = y * y_shift + z * z_shift + x;
        const start_offset = index * nbits;
        const start_arr_index = start_offset >>> 5;
        const end_arr_index = ((index + 1) * nbits - 1) >>> 5;
        const start_bit_offset = start_offset & 0x1f;

        const half_ind = start_arr_index >>> 1;
        let blockStart: number;
        let blockEnd: number;

        if ((start_arr_index & 0x1) === 0) {
          blockStart = regionData[half_ind][1];
          blockEnd = regionData[half_ind][0];
        } else {
          blockStart = regionData[half_ind][0];
          if (half_ind + 1 < regionData.length) {
            blockEnd = regionData[half_ind + 1][1];
          } else {
            blockEnd = 0x0;
          }
        }

        if (start_arr_index === end_arr_index) {
          blocks[x][y][z] = (blockStart >>> start_bit_offset) & mask;
        } else {
          const end_offset = 32 - start_bit_offset;
          const val =
            ((blockStart >>> start_bit_offset) & mask) |
            ((blockEnd << end_offset) & mask);
          blocks[x][y][z] = val;
        }
      }
    }
  }
  return blocks;
};

const readLitematicFromNBTData = (nbtdata: any): Litematic => {
  const litematic = new Litematic();
  const regions = nbtdata.value.Regions.value;

  for (const regionName in regions) {
    const region = regions[regionName].value;
    const blockPalette = stripNBTTyping(region.BlockStatePalette);
    const nbits = Math.ceil(Math.log2(blockPalette.length));

    const width = region.Size.value.x.value;
    const height = region.Size.value.y.value;
    const depth = region.Size.value.z.value;

    const blockData = region.BlockStates.value;
    const blocks = processNBTRegionData(blockData, nbits, width, height, depth);

    const litematicRegion = new LitematicRegion(width, height, depth);
    litematicRegion.blocks = blocks;
    litematicRegion.blockPalette = blockPalette;

    litematic.regions.push(litematicRegion);
  }

  return litematic;
};

const loadDeepslateResources = (textureImage: HTMLImageElement) => {
  console.log("loading resources...");

  if (!window.deepslate || !window.assets) {
    console.error("Deepslate or assets not loaded");
    return null;
  }

  const blockDefinitions: any = {};
  Object.keys(window.assets.blockstates).forEach((id) => {
    blockDefinitions["minecraft:" + id] =
      window.deepslate.BlockDefinition.fromJson(
        id,
        window.assets.blockstates[id]
      );
  });

  const blockModels: any = {};
  Object.keys(window.assets.models).forEach((id) => {
    blockModels["minecraft:" + id] = window.deepslate.BlockModel.fromJson(
      id,
      window.assets.models[id]
    );
  });

  Object.values(blockModels).forEach((m: any) =>
    m.flatten({ getBlockModel: (id: string) => blockModels[id] })
  );

  const atlasCanvas = document.createElement("canvas");
  const atlasSize = upperPowerOfTwo(
    textureImage.width >= textureImage.height
      ? textureImage.width
      : textureImage.height
  );
  atlasCanvas.width = textureImage.width;
  atlasCanvas.height = textureImage.height;

  const atlasCtx = atlasCanvas.getContext("2d");
  if (!atlasCtx) {
    console.error("Could not get canvas context");
    return null;
  }

  atlasCtx.drawImage(textureImage, 0, 0);
  const atlasData = atlasCtx.getImageData(0, 0, atlasSize, atlasSize);

  const idMap: any = {};
  Object.keys(window.assets.textures).forEach((id) => {
    const [u, v, du, dv] = window.assets.textures[id];
    const dv2 = du !== dv && id.startsWith("block/") ? du : dv;
    idMap["minecraft:" + id] = [
      u / atlasSize,
      v / atlasSize,
      (u + du) / atlasSize,
      (v + dv2) / atlasSize,
    ];
  });

  const textureAtlas = new window.deepslate.TextureAtlas(atlasData, idMap);

  return {
    getBlockDefinition(id: string) {
      return blockDefinitions[id];
    },
    getBlockModel(id: string) {
      return blockModels[id];
    },
    getTextureUV(id: string) {
      return textureAtlas.getTextureUV(id);
    },
    getTextureAtlas() {
      return textureAtlas.getTextureAtlas();
    },
    getBlockFlags(id: string) {
      return {
        opaque: window.OPAQUE_BLOCKS?.has(id.toString()) || false,
        self_culling: !window.NON_SELF_CULLING?.has(id.toString()) || true,
        semi_transparent:
          window.TRANSPARENT_BLOCKS?.has(id.toString()) || false,
      };
    },
    getBlockProperties() {
      return null;
    },
    getDefaultBlockProperties() {
      return null;
    },
  };
};

const structureFromLitematic = (
  litematic: Litematic,
  y_min = 0,
  y_max = -1
) => {
  if (!window.deepslate) {
    throw new Error("Deepslate not loaded");
  }

  const blocks = litematic.regions[0].blocks;
  const blockPalette = litematic.regions[0].blockPalette;

  const width = blocks.length;
  const height = blocks[0].length;
  const depth = blocks[0][0].length;

  if (y_max === -1) {
    y_max = height;
  }
  y_max = Math.min(y_max, height);

  const structure = new window.deepslate.Structure([width, height, depth]);

  let blockCount = 0;
  console.log("Building blocks...");

  for (let x = 0; x < width; x++) {
    for (let y = y_min; y < y_max; y++) {
      for (let z = 0; z < depth; z++) {
        const blockID = blocks[x][y][z];

        if (blockID > 0) {
          if (blockID < blockPalette.length) {
            const blockInfo = blockPalette[blockID];
            const blockName = blockInfo.Name;
            blockCount++;

            if (blockInfo.hasOwnProperty("Properties")) {
              structure.addBlock([x, y, z], blockName, blockInfo.Properties);
            } else {
              structure.addBlock([x, y, z], blockName);
            }
          } else {
            structure.addBlock([x, y, z], "minecraft:cake");
          }
        }
      }
    }
  }

  console.log("Done!", blockCount, "blocks created");
  return structure;
};

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
  const [resourcesLoaded, setResourcesLoaded] = useState(false);

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
  const deepslateResourcesRef = useRef<any>(null);

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

    // Ensure WebGL viewport is correct before rendering
    const gl =
      canvasRef.current.getContext("webgl2") ||
      canvasRef.current.getContext("webgl");
    if (gl) {
      gl.viewport(0, 0, canvasRef.current.width, canvasRef.current.height);
      // Clear with a better background
      gl.clearColor(0.2, 0.2, 0.2, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    const view = mat4.create();
    mat4.rotateX(view, view, camera.pitch);
    mat4.rotateY(view, view, camera.yaw);
    mat4.translate(view, view, camera.pos);

    rendererRef.current.drawStructure(view);
    rendererRef.current.drawGrid(view);

    animationFrameRef.current = requestAnimationFrame(render);
  }, [updateCameraFromKeys]);

  // Static resource loading effect
  useEffect(() => {
    const initializeResources = async () => {
      try {
        console.log("Starting resource initialization...");

        // Check if scripts are already loaded in the document
        const scriptsToLoad = [
          "/litematic-viewer/resource/deepslate.js",
          "/litematic-viewer/resource/gl-matrix-min.js",
          "/litematic-viewer/resource/assets.js",
          "/litematic-viewer/resource/opaque.js",
        ];

        // Load scripts synchronously if not already loaded
        for (const scriptSrc of scriptsToLoad) {
          console.log(`Checking script: ${scriptSrc}`);
          if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
            console.log(`Loading script: ${scriptSrc}`);
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement("script");
              script.src = scriptSrc;
              script.onload = () => {
                console.log(`Successfully loaded: ${scriptSrc}`);
                // Special handling for assets.js - manually expose assets to window
                if (scriptSrc.includes("assets.js")) {
                  setTimeout(() => {
                    try {
                      // Try to access the assets variable and put it on window
                      const assetsScript = document.createElement("script");
                      assetsScript.textContent = `
                        if (typeof assets !== 'undefined' && !window.assets) {
                          window.assets = assets;
                          console.log('Assets exposed to window:', !!window.assets);
                        }
                      `;
                      document.head.appendChild(assetsScript);
                    } catch (e) {
                      console.log("Could not expose assets to window:", e);
                    }
                  }, 100);
                }
                resolve();
              };
              script.onerror = () => {
                console.error(`Failed to load: ${scriptSrc}`);
                reject(new Error(`Failed to load script: ${scriptSrc}`));
              };
              document.head.appendChild(script);
            });
          } else {
            console.log(`Script already loaded: ${scriptSrc}`);
          }
        }

        // Wait longer for scripts to initialize and check multiple times
        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          attempts++;

          // Check if assets is available via eval (assets may be in global scope but not on window)
          let assetsAvailable = !!window.assets;
          if (!assetsAvailable) {
            try {
              // Check if assets exists globally
              const globalAssets = eval(
                'typeof assets !== "undefined" ? assets : null'
              );
              if (globalAssets) {
                (window as any).assets = globalAssets;
                assetsAvailable = true;
              }
            } catch (e) {
              // assets not available globally
            }
          }

          console.log(
            `Attempt ${attempts}: Checking window.deepslate=${!!window.deepslate}, assets=${!!assetsAvailable}`
          );

          if (window.deepslate && assetsAvailable) {
            console.log("All resources available, proceeding...");
            break;
          }

          if (attempts >= maxAttempts) {
            throw new Error(
              `Resources not available after ${maxAttempts} attempts. deepslate: ${!!window.deepslate}, assets: ${!!assetsAvailable}`
            );
          }
        }

        // Load texture atlas
        console.log("Loading texture atlas...");
        const image = new Image();
        image.crossOrigin = "anonymous";

        await new Promise<void>((resolve, reject) => {
          image.onload = () => {
            console.log(
              "Texture atlas loaded, initializing deepslate resources..."
            );
            try {
              deepslateResourcesRef.current = loadDeepslateResources(image);
              if (deepslateResourcesRef.current) {
                console.log("Deepslate resources initialized successfully");
                setResourcesLoaded(true);
                resolve();
              } else {
                reject(new Error("loadDeepslateResources returned null"));
              }
            } catch (err) {
              console.error("Error in loadDeepslateResources:", err);
              reject(new Error("Failed to initialize deepslate resources"));
            }
          };
          image.onerror = (err) => {
            console.error("Failed to load texture atlas:", err);
            reject(new Error("Failed to load texture atlas"));
          };
          image.src = "/litematic-viewer/resource/atlas.png";
        });
      } catch (err) {
        console.error("Failed to initialize resources:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load viewer dependencies"
        );
      }
    };

    initializeResources();
  }, []);

  useEffect(() => {
    if (
      !fileUrl ||
      !canvasRef.current ||
      !resourcesLoaded ||
      !deepslateResourcesRef.current
    ) {
      return;
    }

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

        const structureLitematic = readLitematicFromNBTData(nbtData);
        if (!structureLitematic) {
          throw new Error("Failed to parse litematic data");
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        // WebGL context options for better quality
        const contextOptions = {
          antialias: true,
          alpha: false,
          depth: true,
          stencil: false,
          preserveDrawingBuffer: false,
          powerPreference: "high-performance" as const,
        };

        const gl =
          canvas.getContext("webgl2", contextOptions) ||
          canvas.getContext("webgl", contextOptions);

        if (!gl) {
          throw new Error("WebGL not supported");
        }

        // Enable additional WebGL features for better quality
        const webgl = gl as WebGLRenderingContext | WebGL2RenderingContext;
        webgl.enable(webgl.DEPTH_TEST);
        webgl.enable(webgl.CULL_FACE);
        webgl.cullFace(webgl.BACK);
        webgl.frontFace(webgl.CCW);

        const structure = structureFromLitematic(structureLitematic);

        // Ensure proper canvas sizing before creating renderer
        const container = canvas.parentElement;
        if (container) {
          const devicePixelRatio = window.devicePixelRatio || 1;
          const displayWidth = container.clientWidth;
          const displayHeight = container.clientHeight;

          // Set the actual canvas size in pixels (considering device pixel ratio)
          canvas.width = displayWidth * devicePixelRatio;
          canvas.height = displayHeight * devicePixelRatio;

          // Scale the canvas back down using CSS to the display size
          canvas.style.width = displayWidth + "px";
          canvas.style.height = displayHeight + "px";

          // Update WebGL viewport
          webgl.viewport(0, 0, canvas.width, canvas.height);

          console.log(
            `Canvas initialized: display=${displayWidth}x${displayHeight}, actual=${canvas.width}x${canvas.height}, ratio=${devicePixelRatio}`
          );
        }

        rendererRef.current = new window.deepslate.StructureRenderer(
          webgl,
          structure,
          deepslateResourcesRef.current,
          {
            chunkSize: 8,
            // Add other potential quality options
            renderDistance: 128,
            enableShadows: true,
            enableAmbientOcclusion: true,
          }
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
  }, [fileUrl, render, resourcesLoaded]);

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

  const resetView = useCallback(() => {
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
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const displayWidth = container.clientWidth;
        const displayHeight = container.clientHeight;

        // Set the actual canvas size in pixels (considering device pixel ratio)
        canvas.width = displayWidth * devicePixelRatio;
        canvas.height = displayHeight * devicePixelRatio;

        // Scale the canvas back down using CSS to the display size
        canvas.style.width = displayWidth + "px";
        canvas.style.height = displayHeight + "px";

        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (gl) {
          gl.viewport(0, 0, canvas.width, canvas.height);
          console.log(
            `Canvas resized: display=${displayWidth}x${displayHeight}, actual=${canvas.width}x${canvas.height}, ratio=${devicePixelRatio}`
          );
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

  if (!resourcesLoaded) {
    return (
      <Box
        width={width}
        height={height}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <VStack>
          <Box
            width={8}
            height={8}
            border="2px solid"
            borderColor="blue.500"
            borderTopColor="transparent"
            borderRadius="full"
            animation="spin 1s linear infinite"
          />
          <Text color="gray.500">Loading viewer resources...</Text>
        </VStack>
      </Box>
    );
  }

  if (!fileUrl) {
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
          <Text color="gray.500">No schematic file provided</Text>
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
            imageRendering: "auto",
            display: "block",
            // Force hardware acceleration
            transform: "translateZ(0)",
            // Prevent browser scaling
            touchAction: "none",
            // Ensure crisp rendering
            WebkitFontSmoothing: "antialiased",
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

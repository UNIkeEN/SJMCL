import {
  Box,
  Card,
  HStack,
  IconButton,
  Input,
  Tag,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuArrowLeft, LuCode, LuRotateCw, LuX } from "react-icons/lu";
import { useSharedModals } from "@/contexts/shared-modal";
import { isProd } from "@/utils/env";

const DevToolbarContent: React.FC = () => {
  const router = useRouter();
  const { openSharedModal } = useSharedModals();
  const [inputValue, setInputValue] = useState("");
  const [inputType, setInputType] = useState<string>("route");
  const [loadTime, setLoadTime] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (inputType === "route") setInputValue(router.asPath);
  }, [router.asPath, inputType]);

  useEffect(() => {
    // switch to modal from route, clear input
    if (inputType === "modal") setInputValue("");
  }, [inputType]);

  // calculate load time on route change
  useEffect(() => {
    const handleRouteChangeStart = () => {
      setStartTime(performance.now());
    };
    const handleRouteChangeComplete = () => {
      if (startTime !== null) {
        const duration = performance.now() - startTime;
        setLoadTime(duration.toFixed(1));
        setStartTime(null);
      }
    };

    router.events.on("routeChangeStart", handleRouteChangeStart);
    router.events.on("routeChangeComplete", handleRouteChangeComplete);
    return () => {
      router.events.off("routeChangeStart", handleRouteChangeStart);
      router.events.off("routeChangeComplete", handleRouteChangeComplete);
    };
  }, [startTime, router.events]);

  const inputTypes: Record<string, string> = {
    route: "blue",
    modal: "purple",
    invoke: "green",
  };

  const handleInputKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter" && inputValue.trim()) {
      const trimmedPath = inputValue.trim();

      // open shared modal
      if (inputType === "route") {
        if (trimmedPath.startsWith("/")) {
          router.push(trimmedPath);
        } else {
          openUrl(trimmedPath);
        }
      } else {
        const match = trimmedPath.match(/^([^:]+)(?::(.*))?$/);
        if (match) {
          const key = match[1];
          const paramString = match[2];
          try {
            const params = paramString ? JSON.parse(`${paramString}`) : {};
            if (inputType === "modal") {
              openSharedModal(key, params);
            } else if (inputType === "invoke") {
              try {
                const res = await invoke(key, params);
                logger.info("Invoke result:", res);
              } catch (err) {
                logger.error("Invoke error:", err);
              }
            }
            setInputValue("");
          } catch (err) {
            logger.error("Failed to parse modal params:", err);
          }
        }
      }
    }
  };

  return (
    <HStack spacing={0}>
      <IconButton
        icon={<LuArrowLeft />}
        aria-label="Back"
        variant="ghost"
        onClick={() => router.back()}
      />
      <IconButton
        icon={<LuRotateCw />}
        aria-label="Reload"
        variant="ghost"
        onClick={() => router.reload()}
      />
      <Tag
        cursor="pointer"
        colorScheme={inputTypes[inputType]}
        onClick={() => {
          const inputTypeKeys = Object.keys(inputTypes);
          setInputType(
            inputTypeKeys[
              (inputTypeKeys.indexOf(inputType) + 1) % inputTypeKeys.length
            ]
          );
        }}
      >
        {inputType}
      </Tag>
      <Input
        className="secondary-text"
        size="xs"
        variant="unstyled"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleInputKeyDown}
        width={200}
        mx={2}
        placeholder={inputType === "route" ? "" : "key(:params)"}
      />
      {loadTime && (
        <Text
          fontSize="xs"
          className="secondary-text"
          whiteSpace="nowrap"
          mr={2}
        >
          {loadTime} ms
        </Text>
      )}
    </HStack>
  );
};

const DevToolbar: React.FC = () => {
  const { t } = useTranslation();

  const containerRef = useRef<HTMLDivElement>(null);
  const offset = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [collapseDirection, setCollapseDirection] = useState<"left" | "right">(
    "right"
  );

  type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
  const anchorRef = useRef<{ corner: Corner; dx: number; dy: number } | null>(
    null
  );

  const getCornerPosition = useCallback((corner: Corner) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    switch (corner) {
      case "top-left":
        return { x: 0, y: 0 };
      case "top-right":
        return { x: w, y: 0 };
      case "bottom-left":
        return { x: 0, y: h };
      case "bottom-right":
        return { x: w, y: h };
    }
  }, []);

  const getNearestCorner = useCallback(
    (center: { x: number; y: number }) => {
      const corners: Corner[] = [
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
      ];
      let minCorner = corners[0];
      let minDist = Infinity;
      for (const corner of corners) {
        const c = getCornerPosition(corner);
        const dist = Math.hypot(center.x - c.x, center.y - c.y);
        if (dist < minDist) {
          minDist = dist;
          minCorner = corner;
        }
      }
      return minCorner;
    },
    [getCornerPosition]
  );

  const updateAnchorCorner = useCallback(
    (x: number, y: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const center = { x: x + rect.width / 2, y: y + rect.height / 2 };
      const nearestCorner = getNearestCorner(center);
      const cornerPos = getCornerPosition(nearestCorner);
      anchorRef.current = {
        corner: nearestCorner,
        dx: center.x - cornerPos.x,
        dy: center.y - cornerPos.y,
      };
    },
    [getCornerPosition, getNearestCorner]
  );

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = 8;
      const y = window.innerHeight - rect.height - 8;
      setPosition({ x, y });
      updateAnchorCorner(x, y);
    }
  }, [updateAnchorCorner]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      offset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    },
    [position]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      didDrag.current = true;
      const rect = containerRef.current.getBoundingClientRect();
      const newX = e.clientX - offset.current.x;
      const newY = e.clientY - offset.current.y;
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      setPosition({
        x: Math.min(Math.max(0, newX), maxX),
        y: Math.min(Math.max(0, newY), maxY),
      });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    updateAnchorCorner(position.x, position.y);
    setTimeout(() => {
      didDrag.current = false;
    }, 0);
  }, [position, updateAnchorCorner]);

  const handleWindowResize = useCallback(() => {
    if (!containerRef.current || !anchorRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const { corner, dx, dy } = anchorRef.current;
    const cornerPos = getCornerPosition(corner);
    const newCenterX = cornerPos.x + dx;
    const newCenterY = cornerPos.y + dy;
    const newX = newCenterX - rect.width / 2;
    const newY = newCenterY - rect.height / 2;
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    setPosition({
      x: Math.min(Math.max(0, newX), maxX),
      y: Math.min(Math.max(0, newY), maxY),
    });
  }, [getCornerPosition]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [handleMouseMove, handleMouseUp, handleWindowResize]);

  useEffect(() => {
    if (!isExpanded && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = position.x + rect.width / 2;
      const isLeftSide = centerX < window.innerWidth / 2;
      setCollapseDirection(isLeftSide ? "right" : "left");
    }
  }, [isExpanded, position]);

  if (isProd || process.env.NEXT_PUBLIC_DEV_TOOLBAR === "false") return null;

  return (
    <Box
      ref={containerRef}
      position="fixed"
      top={`${position.y}px`}
      left={`${position.x}px`}
      zIndex={999}
    >
      <Box position="relative" display="flex" alignItems="center">
        <Card
          position="absolute"
          left={collapseDirection === "right" ? "100%" : undefined}
          right={collapseDirection === "left" ? "100%" : undefined}
          ml={collapseDirection === "right" ? 2 : undefined}
          mr={collapseDirection === "left" ? 2 : undefined}
          boxShadow="lg"
          transition="all 0.5s ease"
          opacity={isExpanded ? 1 : 0}
          visibility={isExpanded ? "visible" : "hidden"}
          transform={
            isExpanded
              ? "translateX(0)"
              : collapseDirection === "right"
                ? "translateX(-20px)"
                : "translateX(20px)"
          }
          pointerEvents={isExpanded ? "auto" : "none"}
        >
          <DevToolbarContent />
        </Card>

        <Card boxShadow="lg">
          <Tooltip label={t("DevToolbar.tooltip")} isDisabled={isExpanded}>
            <IconButton
              icon={isExpanded ? <LuX /> : <LuCode />}
              aria-label="DevTools"
              variant="ghost"
              cursor={isDragging ? "grabbing" : "grab"}
              onClick={() => {
                if (!didDrag.current) {
                  setIsExpanded((prev) => !prev);
                }
              }}
              onMouseDown={handleMouseDown}
            />
          </Tooltip>
        </Card>
      </Box>
    </Box>
  );
};

export default DevToolbar;

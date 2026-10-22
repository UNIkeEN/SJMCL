import {
  Center,
  ToastId,
  UseToastOptions,
  useToast as chakraUseToast,
  useColorModeValue,
} from "@chakra-ui/react";
import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
} from "react";
import { BeatLoader } from "react-spinners";

interface ToastContextProviderProps {
  children: ReactNode;
}

interface ToastContextType {
  (options: UseToastOptions): ToastId;
}

const ToastContext = createContext<ToastContextType | null>(null);

// How long a toast's identity is remembered for deduplication. Toasts live
// 3000ms, so a slightly longer window also swallows bursts that arrive just as
// the previous one expires.
const DEDUP_WINDOW_MS = 4000;

/// Build a stable deduplication key from a scope plus the values that make a
/// toast distinct.
///
/// Every call site that can fire the same notification more than once uses this
/// instead of hand-writing a template string, so the key format stays uniform
/// and a caller cannot accidentally collide with or miss another.
export const toastKey = (scope: string, ...parts: unknown[]): string =>
  [scope, ...parts.map((p) => String(p))].join("|");

export const ToastContextProvider: React.FC<ToastContextProviderProps> = ({
  children,
}) => {
  const chakraToast = chakraUseToast();
  const toastVariant = useColorModeValue("left-accent", "solid");
  // Recent toast identities, mapped to the id of the toast still on screen.
  // Repeated events (a group completing once per duplicate group, a refresh
  // firing several times, a network error retried in a loop) otherwise stack up
  // identical toasts in the bottom-left corner.
  const recentIds = React.useRef(new Map<string, ToastId>());
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  React.useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    []
  );

  const customToast: ToastContextType = useCallback(
    (options) => {
      // Callers pass a stable `id` to opt into deduplication. Without one the
      // toast is always shown, so existing call sites keep their behaviour.
      const dedupKey = options.id;
      if (dedupKey !== undefined) {
        const key = String(dedupKey);
        const existing = recentIds.current.get(key);
        // `isActive` only accepts a numeric id; Chakra also hands out string ids
        // in some code paths. Treat a non-numeric id as "unknown state" and fall
        // through to the timer-based window below instead of crashing.
        if (
          existing !== undefined &&
          typeof existing === "number" &&
          chakraToast.isActive(existing)
        ) {
          return existing;
        }
      }

      let id = chakraToast({
        position: "bottom-left",
        duration: options.status === "loading" ? null : 3000,
        icon:
          options.status === "loading" ? (
            <Center h="100%" mt={0.5}>
              <BeatLoader size={4} />
            </Center>
          ) : null,
        variant: toastVariant,
        isClosable: true,
        containerStyle: {
          minWidth: "2xs",
          userSelect: "none",
        },
        ...options,
      });

      if (dedupKey !== undefined && options.status !== "loading") {
        const key = String(dedupKey);
        recentIds.current.set(key, id);
        const prev = timers.current.get(key);
        if (prev) clearTimeout(prev);
        timers.current.set(
          key,
          setTimeout(() => {
            recentIds.current.delete(key);
            timers.current.delete(key);
          }, DEDUP_WINDOW_MS)
        );
      }

      return id;
    },
    [chakraToast, toastVariant]
  );

  return (
    <ToastContext.Provider value={customToast}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context)
    throw new Error("useToast must be used within a ToastContextProvider");
  return context;
};

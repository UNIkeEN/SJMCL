import type { Shape } from "canvas-confetti";

type ConfettiFn = typeof import("canvas-confetti");
let confettiPromise: Promise<ConfettiFn> | null = null;

// lazy load
const loadConfetti = async () => {
  if (!confettiPromise) {
    confettiPromise = import("canvas-confetti").then(
      (module) => (module.default ?? module) as ConfettiFn
    );
  }
  return confettiPromise;
};

const defaults = {
  ticks: 80,
  zIndex: 2000, // above the modal overlay.
};

export const confettiSchoolPride = async () => {
  const confetti = await loadConfetti();

  await Promise.all([
    confetti({
      particleCount: 200,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      ...defaults,
    }),
    confetti({
      particleCount: 200,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      ...defaults,
    }),
  ]);
};

export const confettiStars = async () => {
  const confetti = await loadConfetti();

  await confetti({
    shapes: ["star"] as Shape[],
    colors: ["#FFE400", "#FFBD00", "#E89400", "#FFCA6C", "#FDFFB8"],
    particleCount: 200,
    spread: 360,
    origin: { x: 0.5, y: 0.35 },
    startVelocity: 25,
    ...defaults,
  });
};

const defaults = {
  ticks: 80,
  zIndex: 2000, // above the modal overlay.
};

export const confettiSchoolPride = async () => {
  const { default: confetti } = await import("canvas-confetti");
  confetti({
    particleCount: 200,
    angle: 60,
    spread: 55,
    origin: { x: 0 },
    ...defaults,
  });
  confetti({
    particleCount: 200,
    angle: 120,
    spread: 55,
    origin: { x: 1 },
    ...defaults,
  });
};

export const confettiStars = async () => {
  const { default: confetti } = await import("canvas-confetti");
  const stars = {
    shapes: ["star"] as import("canvas-confetti").Shape[],
    colors: ["FFE400", "FFBD00", "E89400", "FFCA6C", "FDFFB8"],
    ...defaults,
  };

  confetti({
    ...stars,
    particleCount: 200,
    spread: 360,
    origin: { x: 0.5, y: 0.35 },
    startVelocity: 25,
  });
};

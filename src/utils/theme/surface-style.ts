export type SurfaceStyleOption = "flat" | "acrylic" | "liquid";

export const DEFAULT_SURFACE_STYLE: SurfaceStyleOption = "acrylic";

type SurfaceTokens = Record<string, string>;

type SurfaceTokenMap = Record<SurfaceStyleOption, SurfaceTokens>;

const lightTokens: SurfaceTokenMap = {
  flat: {
    "--sjmcl-card-front-bg": "rgba(248, 250, 252, 0.96)",
    "--sjmcl-card-front-backdrop": "none",
    "--sjmcl-card-front-shadow": "0 12px 24px rgba(15, 23, 42, 0.12)",
    "--sjmcl-card-front-border": "1px solid rgba(148, 163, 184, 0.22)",
    "--sjmcl-card-back-bg": "rgba(241, 245, 249, 0.92)",
    "--sjmcl-card-back-backdrop": "none",
    "--sjmcl-card-back-shadow": "0 18px 36px rgba(15, 23, 42, 0.18)",
    "--sjmcl-acrylic-bg": "rgba(248, 250, 252, 0.96)",
    "--sjmcl-acrylic-border": "rgba(148, 163, 184, 0.22)",
    "--sjmcl-acrylic-shadow": "0 18px 32px rgba(148, 163, 184, 0.22)",
    "--sjmcl-acrylic-backdrop": "none",
    "--sjmcl-instance-list-bg": "rgba(248, 250, 252, 0.92)",
    "--sjmcl-instance-list-backdrop": "blur(20px) saturate(125%)",
    "--sjmcl-instance-list-shadow": "0 16px 32px rgba(15, 23, 42, 0.18)",
    "--sjmcl-instance-list-border": "1px solid rgba(148, 163, 184, 0.2)",
    "--sjmcl-instance-list-hover-bg": "rgba(148, 163, 184, 0.12)",
    "--sjmcl-instance-list-active-bg": "rgba(148, 163, 184, 0.18)",
  },
  acrylic: {
    "--sjmcl-card-front-bg": "rgba(255, 255, 255, 0.56)",
    "--sjmcl-card-front-backdrop": "blur(20px) saturate(125%)",
    "--sjmcl-card-front-shadow": "0 22px 45px rgba(15, 23, 42, 0.28)",
    "--sjmcl-card-front-border": "1px solid rgba(148, 163, 184, 0.28)",
    "--sjmcl-card-back-bg": "rgba(246, 249, 255, 0.63)",
    "--sjmcl-card-back-backdrop": "blur(24px)",
    "--sjmcl-card-back-shadow": "0 28px 52px rgba(15, 23, 42, 0.32)",
    "--sjmcl-acrylic-bg": "rgba(255, 255, 255, 0.84)",
    "--sjmcl-acrylic-border": "rgba(148, 163, 184, 0.28)",
    "--sjmcl-acrylic-shadow": "0 18px 32px rgba(148, 163, 184, 0.25)",
    "--sjmcl-acrylic-backdrop": "blur(18px)",
    "--sjmcl-instance-list-bg": "rgba(250, 250, 250, 0.67)",
    "--sjmcl-instance-list-backdrop": "blur(22px) saturate(150%)",
    "--sjmcl-instance-list-shadow": "0 18px 40px rgba(15, 23, 42, 0.24)",
    "--sjmcl-instance-list-border": "1px solid rgba(148, 163, 184, 0.22)",
    "--sjmcl-instance-list-hover-bg": "rgba(148, 163, 184, 0.18)",
    "--sjmcl-instance-list-active-bg": "rgba(148, 163, 184, 0.24)",
  },
  liquid: {
    "--sjmcl-card-front-bg": "rgba(255, 255, 255, 0.65)",
    "--sjmcl-card-front-backdrop": "blur(32px) saturate(185%)",
    "--sjmcl-card-front-shadow": "0 28px 60px rgba(15, 23, 42, 0.38)",
    "--sjmcl-card-front-border": "1px solid rgba(148, 163, 184, 0.24)",
    "--sjmcl-card-back-bg": "rgba(236, 242, 255, 0.41)",
    "--sjmcl-card-back-backdrop": "blur(32px) saturate(160%)",
    "--sjmcl-card-back-shadow": "0 32px 72px rgba(15, 23, 42, 0.4)",
    "--sjmcl-acrylic-bg": "rgba(255, 255, 255, 0.81)",
    "--sjmcl-acrylic-border": "rgba(148, 163, 184, 0.24)",
    "--sjmcl-acrylic-shadow": "0 24px 48px rgba(15, 23, 42, 0.36)",
    "--sjmcl-acrylic-backdrop": "blur(28px)",
    "--sjmcl-instance-list-bg": "rgba(255, 255, 255, 0.32)",
    "--sjmcl-instance-list-backdrop": "blur(28px) saturate(210%)",
    "--sjmcl-instance-list-shadow": "0 22px 46px rgba(15, 23, 42, 0.28)",
    "--sjmcl-instance-list-border": "1px solid rgba(148, 163, 184, 0.2)",
    "--sjmcl-instance-list-hover-bg": "rgba(148, 163, 184, 0.2)",
    "--sjmcl-instance-list-active-bg": "rgba(148, 163, 184, 0.28)",
  },
};

const darkTokens: SurfaceTokenMap = {
  flat: {
    "--sjmcl-card-front-bg": "#2E2E2E",
    "--sjmcl-card-front-backdrop": "none",
    "--sjmcl-card-front-shadow": "0 12px 28px rgba(2, 8, 23, 0.45)",
    "--sjmcl-card-front-border": "1px solid rgba(148, 163, 184, 0.14)",
    "--sjmcl-card-back-bg": "rgba(16, 19, 27, 0.88)",
    "--sjmcl-card-back-backdrop": "none",
    "--sjmcl-card-back-shadow": "0 24px 40px rgba(2, 8, 23, 0.5)",
    "--sjmcl-acrylic-bg": "#2E2E2E",
    "--sjmcl-acrylic-border": "rgba(148, 163, 184, 0.14)",
    "--sjmcl-acrylic-shadow": "0 18px 34px rgba(2, 8, 23, 0.45)",
    "--sjmcl-acrylic-backdrop": "none",
    "--sjmcl-instance-list-bg": "rgba(46, 46, 46, 0.82)",
    "--sjmcl-instance-list-backdrop": "none",
    "--sjmcl-instance-list-shadow": "0 20px 44px rgba(2, 8, 23, 0.52)",
    "--sjmcl-instance-list-border": "1px solid rgba(148, 163, 184, 0.16)",
    "--sjmcl-instance-list-hover-bg": "rgba(148, 163, 184, 0.14)",
    "--sjmcl-instance-list-active-bg": "rgba(148, 163, 184, 0.22)",
  },
  acrylic: {
    "--sjmcl-card-front-bg": "rgba(34, 35, 37, 0.66)",
    "--sjmcl-card-front-backdrop": "blur(20px) saturate(140%)",
    "--sjmcl-card-front-shadow": "0 26px 52px rgba(2, 8, 23, 0.62)",
    "--sjmcl-card-front-border": "1px solid rgba(148, 163, 184, 0.22)",
    "--sjmcl-card-back-bg": "rgba(12, 16, 24, 0.78)",
    "--sjmcl-card-back-backdrop": "blur(24px) saturate(130%)",
    "--sjmcl-card-back-shadow": "0 32px 64px rgba(2, 8, 23, 0.66)",
    "--sjmcl-acrylic-bg": "rgba(18, 24, 36, 0.66)",
    "--sjmcl-acrylic-border": "rgba(148, 163, 184, 0.22)",
    "--sjmcl-acrylic-shadow": "0 22px 48px rgba(2, 8, 23, 0.62)",
    "--sjmcl-acrylic-backdrop": "blur(18px)",
    "--sjmcl-instance-list-bg": "rgba(24, 28, 38, 0.56)",
    "--sjmcl-instance-list-backdrop": "blur(26px) saturate(150%)",
    "--sjmcl-instance-list-shadow": "0 28px 58px rgba(2, 8, 23, 0.7)",
    "--sjmcl-instance-list-border": "1px solid rgba(148, 163, 184, 0.22)",
    "--sjmcl-instance-list-hover-bg": "rgba(148, 163, 184, 0.18)",
    "--sjmcl-instance-list-active-bg": "rgba(148, 163, 184, 0.26)",
  },
  liquid: {
    "--sjmcl-card-front-bg": "rgba(13, 18, 30, 0.48)",
    "--sjmcl-card-front-backdrop": "blur(36px) saturate(220%)",
    "--sjmcl-card-front-shadow": "0 34px 72px rgba(2, 8, 23, 0.7)",
    "--sjmcl-card-front-border": "1px solid rgba(148, 163, 184, 0.26)",
    "--sjmcl-card-back-bg": "rgba(6, 10, 19, 0.32)",
    "--sjmcl-card-back-backdrop": "blur(36px) saturate(200%)",
    "--sjmcl-card-back-shadow": "0 40px 84px rgba(2, 8, 23, 0.72)",
    "--sjmcl-acrylic-bg": "rgba(13, 18, 30, 0.48)",
    "--sjmcl-acrylic-border": "rgba(148, 163, 184, 0.26)",
    "--sjmcl-acrylic-shadow": "0 28px 60px rgba(2, 8, 23, 0.68)",
    "--sjmcl-acrylic-backdrop": "blur(28px)",
    "--sjmcl-instance-list-bg": "rgba(13, 18, 30, 0.4)",
    "--sjmcl-instance-list-backdrop": "blur(34px) saturate(220%)",
    "--sjmcl-instance-list-shadow": "0 32px 64px rgba(2, 8, 23, 0.76)",
    "--sjmcl-instance-list-border": "1px solid rgba(148, 163, 184, 0.24)",
    "--sjmcl-instance-list-hover-bg": "rgba(148, 163, 184, 0.2)",
    "--sjmcl-instance-list-active-bg": "rgba(148, 163, 184, 0.3)",
  },
};

export const resolveSurfaceTokens = (
  surfaceStyle: SurfaceStyleOption,
  colorMode: "light" | "dark"
): SurfaceTokens => {
  const palette = colorMode === "light" ? lightTokens : darkTokens;
  return palette[surfaceStyle] ?? palette[DEFAULT_SURFACE_STYLE];
};

export const deriveSurfaceStyle = (
  surfaceStyle: string | undefined,
  legacyLiquidGlass?: boolean
): SurfaceStyleOption => {
  if (
    surfaceStyle === "flat" ||
    surfaceStyle === "acrylic" ||
    surfaceStyle === "liquid"
  ) {
    return surfaceStyle;
  }
  if (legacyLiquidGlass) {
    return "liquid";
  }
  return DEFAULT_SURFACE_STYLE;
};

export const surfaceStyleToVariant = (
  surfaceStyle: SurfaceStyleOption
): "liquid-glass" | "acrylic" | "elevated" => {
  switch (surfaceStyle) {
    case "liquid":
      return "liquid-glass";
    case "acrylic":
      return "acrylic";
    default:
      return "elevated";
  }
};

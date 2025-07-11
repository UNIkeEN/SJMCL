export const isDev = process.env.NODE_ENV === "development";

export const isProd = process.env.NODE_ENV === "production";

export const checkFrontendCompatibility = () => {
  const checkList = [
    {
      label: "backdrop-filter-blur",
      check: () =>
        CSS.supports("backdrop-filter", "blur(1px)") ||
        CSS.supports("-webkit-backdrop-filter", "blur(1px)"),
      //  NOTE: on Linux, gtk webkit does not support backdrop-filter rendering.
      // Seems like it's dead :( https://gitlab.gnome.org/GNOME/gtk/-/issues/3231
    },
  ];

  const failedChecks = checkList
    .filter((capability) => !capability.check())
    .map((capability) => capability.label);

  const allPassed = failedChecks.length === 0;

  return { allPassed, failedChecks };
};

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import unusedImports from "eslint-plugin-unused-imports";

const nextConfig = nextCoreWebVitals.map((config) => {
  if (!config.rules) return config;

  // Keep the pre-React-Compiler hooks lint behavior during the Next 16 migration.
  const legacyHooksRules = [
    "react-hooks/rules-of-hooks",
    "react-hooks/exhaustive-deps",
  ];

  return {
    ...config,
    rules: Object.fromEntries(
      Object.entries(config.rules).filter(
        ([rule]) =>
          !rule.startsWith("react-hooks/") || legacyHooksRules.includes(rule)
      )
    ),
  };
});

const config = [
  {
    ignores: ["src-tauri/**", "tools/**"],
  },
  ...nextConfig,
  prettierRecommended,
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "prettier/prettier": "warn",
      "unused-imports/no-unused-imports": "warn",
      // "unused-imports/no-unused-vars": "warn",
    },
  },
];

export default config;

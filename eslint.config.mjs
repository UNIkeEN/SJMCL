import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import unusedImports from "eslint-plugin-unused-imports";

const config = [
  {
    ignores: ["src-tauri/**", "tools/**"],
  },
  ...nextCoreWebVitals,
  prettierRecommended,
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "prettier/prettier": "warn",
      "unused-imports/no-unused-imports": "warn",
      // Disable selected React Hooks v7 react-compiler rules for a minimal Next 16 migration.
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
];

export default config;

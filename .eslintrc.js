export default {
  root: true,
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  env: { browser: true, es2021: true },
  extends: ["eslint:recommended", "plugin:react-hooks/recommended"],
  ignorePatterns: ["dist", "src-tauri"],
  rules: {}
};

/* eslint-env node */
/** 中文注释：使用 .cjs 扩展名，在 package.json `"type": "module"` 下仍以 CommonJS 加载，供 ESLint 正确读取。 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["@typescript-eslint"],
  env: { browser: true, es2021: true },
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "plugin:react-hooks/recommended"],
  ignorePatterns: ["dist", "src-tauri"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off"
  }
};

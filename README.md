# dem-app

基于 Tauri + Rust + React + Vite + TypeScript + Ant Design 的桌面应用初始化模板。

## 环境要求

- Node.js >= 18.17.0
- Rust >= 1.75.0 (stable)
- Tauri CLI >= 2.0.0
- npm >= 9.0.0

## 快速开始

```bash
npm install
npm run tauri dev
```

## 扩展说明

- 补丁目录: `patches/`
- 插件目录: `plugins/`
- 前端插件加载器: `src/plugins/loader.tsx`
- 后端扩展系统: `src-tauri/src/extensions/`

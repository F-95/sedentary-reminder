# 前端详细设计（React）-第九版

> **【已锁定】** 锁定日期：2026-05-14。

## 1. 设计概述

### 1.1 设计目标

在主窗口内提供 **常驻底部版本栏** 与 **检查更新** 交互；封装更新调用，保持 **ConfigProvider** 主题策略不变。

### 1.2 设计约束

- 禁止在子页面修改全局 **ConfigProvider** token。
- 禁止使用深度选择器覆盖 Ant Design 组件内部结构；分割线使用 **theme.useToken().colorSplit**。

### 1.3 参考依据

《系统总体设计-第九版》《后端详细设计（Rust）-第九版》。

## 2. 前端目录结构定义

### 2.1 目录层级规范

新增 **`src/utils/appUpdate.ts`**；修改 **`src/pages/HomePage.tsx`**。

### 2.2 各目录职责定义

- **appUpdate.ts**：对 **plugin-updater** 与 **plugin-process** 的薄封装，便于单测与错误边界集中处理。

### 2.3 文件命名规则

与项目规范一致（工具小驼峰）。

## 3. 页面路由设计

### 3.1 路由清单总览

无路由概念变更（单页多视图仍由 **settingsView** 控制）。

### 3.2 路由权限定义

无。

### 3.3 路由跳转规则

底部栏在 **main / stats / author / sedentary / quiet / hydration** 各视图下均可见。

## 4. 组件设计

### 4.1 组件拆分规则

- 底部栏首版内联于 **HomePage**，不抽象为通用组件（避免过度设计）；若第十版复用再提取至 **components**。

### 4.2 通用组件定义

无新增通用组件。

### 4.3 页面组件定义

**HomePage** 增加：
- 状态 **appVersion**、**updateBusy**。
- **theme.useToken** 读取 **colorSplit**。
- **useEffect** 挂载时 **getAppInfo**。
- 处理器 **handleCheckForUpdates**：**fetchAvailableUpdate** → 无则 **message.success**；有则 **Modal.confirm** → 确认后 **installUpdateAndRelaunch**；取消时 **update.close**。
- 布局：外层 **flex 列**，子区 **flex:1 minHeight:0** 保持原有 **Space** 滚动行为；底栏 **flexShrink:0**。

### 4.4 组件Props/State类型定义

- **appVersion**：`string`。
- **updateBusy**：`boolean`。

## 5. 接口请求设计

### 5.1 请求封装规范

- **getAppInfo**：沿用 **`@/utils/tauri`** 的 **invoke** 封装。
- **check / downloadAndInstall / relaunch**：经 **`@/utils/appUpdate`** 导出函数调用。

### 5.2 与后端1:1对齐的接口请求定义

- **get_app_info** 返回字段 **camelCase**：**appId**、**version**、**name**。

### 5.3 请求/响应拦截规则

无 axios 层；Tauri invoke 错误在调用处 **catch** 并 **message.error**。

### 5.4 异常处理规范

- 检查更新异常：前缀 **「检查更新失败：」** 拼接异常字符串。
- 安装异常：前缀 **「安装更新失败：」**。

## 6. 交互流程设计

### 6.1 页面核心交互流程

见《需求规格说明书-第九版》流程图。

### 6.2 加载状态处理

- **updateBusy** 为 true 时刷新按钮 **disabled** 且图标 **spin**。

### 6.3 异常状态处理

- 网络失败、TLS 失败、签名校验失败：统一 **message.error**；不自动重试。

### 6.4 空状态处理

- **getAppInfo** 失败时版本展示 **「未知」**。

## 7. 全局状态管理设计

### 7.1 状态管理方案

仍无 Redux；**HomePage** 局部 **useState** 即可。

### 7.2 全局状态定义

无新增全局 store。

### 7.3 状态更新规则

- 版本号仅在挂载时拉取一次；若未来需「关于」页刷新可复用同一函数。

## 8. 通用规范设计

### 8.1 样式设计规范

- 底栏与内容区间距 **10px** 顶内边距；**1px** 分割线使用 **token.colorSplit**。

### 8.2 性能优化规范

- 不在每秒定时器中调用 **getAppInfo**。

### 8.3 兼容性适配规范

- 依赖 Vite **build.target** 在 Windows 下 **chrome90** 以适配旧 WebView2；Ant Design 5 在目标浏览器上需 smoke 测试。

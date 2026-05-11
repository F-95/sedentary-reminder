# 前端详细设计（React）-第七版

> **【已锁定】** 锁定日期：2026-05-11。

## 1. 设计概述

### 1.1 设计目标

落地主窗标题字符串与 `index.html` 同步；枢纽增加「作者的哔哔赖赖」入口；新增 `AuthorBlurbPage` 与 `HomePage` 视图 `author`。

### 1.2 设计约束

- 不修改根 `ConfigProvider` 主题策略（第六版已定）。
- 随笔页仅用 Ant Design `Typography` / `Card` / `Space`；禁止深度选择器。
- 禁止在随笔页调用 `invoke`（无统计、无配置写）。

### 1.3 参考依据（系统总体设计、需求规格说明书、后端详细设计）

《系统总体设计-第七版》《需求规格说明书-第七版》《后端详细设计（Rust）-第七版》《前端详细设计（React）-第六版》。

## 2. 前端目录结构定义

### 2.1 目录层级规范

与项目规范一致。

### 2.2 各目录职责定义

| 路径 | 第七版职责 |
|------|------------|
| 项目根 `index.html` | `<title>` 与主窗标题一致：`久坐提醒（你的健康搭子）` |
| `src-tauri/tauri.conf.json` | `app.windows[0].title` 同上（构建时生效） |
| `pages/HomePage.tsx` | `settingsView` 联合类型含 `author`；条件渲染 `AuthorBlurbPage`；传入 `onOpenAuthorBlurb` |
| `pages/ReminderSettingsPage.tsx` | 纵向链式入口末尾（或紧随免打扰后）增加「作者的哔哔赖赖」`Button type="link"` + `RightOutlined`；props 增加 `onOpenAuthorBlurb: () => void` |
| `pages/AuthorBlurbPage.tsx` | **新增**：`SubSettingsTopBar` `title="作者的哔哔赖赖"`；`Card` 内多段 `Typography.Paragraph`；末段 `type="secondary"` 为署名行 |
| `components/SubSettingsTopBar.tsx` | **复用**，无 API 变更 |

### 2.3 文件命名规则

`AuthorBlurbPage.tsx` 大驼峰。

## 3. 页面路由设计

### 3.1 路由清单总览

`HomePage` 内：`main` / `sedentary` / `hydration` / `quiet` / `stats` / **`author`**。

### 3.2 路由权限定义

不适用。

### 3.3 路由跳转规则

- `onOpenAuthorBlurb` → `setSettingsView("author")`。
- `AuthorBlurbPage.onBack` → `setSettingsView("main")`。
- 外层 `Space`：`settingsView === "main"` 时 `overflowY: hidden`，否则 `auto`（与第六版一致）。

## 4. 组件设计

### 4.1 组件拆分规则

随笔独立页面文件，不塞入 `ReminderSettingsPage` 的 Card 内（与计划一致：链式入口 + 子页）。

### 4.2 通用组件定义

与第六版一致；第七版不新增通用组件。

### 4.3 页面组件定义

| 组件 | 职责 |
|------|------|
| AuthorBlurbPage | `onBack`；静态展示；无业务 state |
| ReminderSettingsPage | 增加 `onOpenAuthorBlurb` 与入口按钮 |
| HomePage | 扩展视图分支与 props 传递 |

### 4.4 组件Props/State类型定义

- `AuthorBlurbPageProps`: `{ onBack: () => void }`
- `ReminderSettingsPageProps`: 在第六版基础上增加 `onOpenAuthorBlurb: () => void`
- `settingsView` 类型字面量联合含 `'author'`

## 5. 接口请求设计

### 5.1 请求封装规范

第七版随笔页无 `invoke`。

### 5.2 与后端1:1对齐的接口请求定义

无新增；统计与提醒封装仍见 `utils/tauri.ts`（第六版）。

### 5.3 请求/响应拦截规则

不适用本页。

### 5.4 异常处理规范

无网络、无 invoke；无新增异常路径。

## 6. 交互流程设计

### 6.1 页面核心交互流程

点击链式入口 → 子页 → 顶栏返回枢纽。

### 6.2 加载状态处理

不需要 `loading`；文案静态。

### 6.3 异常状态处理

无。

### 6.4 空状态处理

不适用。

## 7. 全局状态管理设计

### 7.1 状态管理方案

与第六版一致；`HomePage` 仅扩展 `settingsView` 枚举。

### 7.2 全局状态定义

| 状态 | 说明 |
|------|------|
| settingsView | 含 `author` |

### 7.3 状态更新规则

进入 `author` 时与进入 `stats` 相同：停止 `hubNowMs` 秒级定时（因 `settingsView !== "main"`）。

## 8. 通用规范设计

### 8.1 样式设计规范

`AuthorBlurbPage` 外层 `Space direction="vertical" size="middle" style={{ width: "100%" }}`，与 `StatisticsPage` 布局同构。

### 8.2 性能优化规范

无图表；无额外 effect。

### 8.3 兼容性适配规范

与第六版一致。

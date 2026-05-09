# 前端详细设计（React）-第六版

> **【已锁定】** 锁定日期：2026-05-09。

## 1. 设计概述

### 1.1 设计目标

实现主题三档、规范 B 子页顶栏、枢纽统计简报与统计详情页；在 `main` 视图控制滚动策略；与后端统计命令对接。

### 1.2 设计约束

- 修改 `App.tsx` 根 `ConfigProvider` 的 `algorithm`（第六版允许且必须）。
- 页面级仅用 Ant Design 公开 API；Plots 通过 `declare module` 补齐类型。
- 禁止深度选择器改 AntD DOM。

### 1.3 参考依据（系统总体设计、需求规格说明书、后端详细设计）

《系统总体设计-第六版》《需求规格说明书-第六版》《后端详细设计（Rust）-第六版》《前端详细设计（React）-第五版》。

## 2. 前端目录结构定义

### 2.1 目录层级规范

与项目规范一致；第六版新增 `components/` 下业务组件。

### 2.2 各目录职责定义

| 路径 | 第六版职责 |
|------|------------|
| App.tsx | `themeMode` 状态、`resolveEffectiveTheme`、`subscribeSystemThemeChanged`、`getCurrentWindow().setTheme`、`ConfigProvider` algorithm |
| pages/HomePage.tsx | `settingsView` 含 `stats`；`statsRefreshKey`；`recordStatEvent` 挂钩；传递 `themeMode` |
| pages/ReminderSettingsPage.tsx | **单张主 Card**：`title` 为关怀文案；`Space` `size=small`；正文顺序：**内嵌** `StatsBriefCard`（`variant=embedded`）→ 久坐 → 补水 → **开机启动**（`Row`+`Switch`）→ **主题模式**（`Row`+`Segmented`，与开关右对齐）→ 纵向设置入口 |
| pages/StatisticsPage.tsx | 详情：`Segmented` 日/周/月/年、`Column` 堆叠 |
| pages/*SettingsPage.tsx | 规范 B：`SubSettingsTopBar` + 无 title/extra 的 `Card` |
| components/SubSettingsTopBar.tsx | 左 `Button type="text"` **仅图标**返回，`aria-label`/`title`「返回主界面」；右 `Typography.Title` |
| components/StatsBriefCard.tsx | `refreshKey`、`onOpenDetail`、`variant`：`embedded`（`Spin`+底部分割线+可点击区，柱高约 88）或 `standalone`（小 `Card`，预留） |
| utils/themeMode.ts | 读写 localStorage、解析、订阅系统主题 |
| utils/statsBuckets.ts | 分桶与查询窗纯函数 |
| utils/tauri.ts | `recordStatEvent`、`queryStatEvents`、`THEME_MODE_STORAGE_KEY` |
| vite-env.d.ts | `declare module '@ant-design/plots'` |

### 2.3 文件命名规则

与项目规范一致。

## 3. 页面路由设计

### 3.1 路由清单总览

`HomePage` 内：`main` / `sedentary` / `hydration` / `quiet` / `stats`。

### 3.2 路由权限定义

不适用。

### 3.3 路由跳转规则

简报点击、`onOpenStats` → `stats`；详情顶栏返回 → `main`。进入 `main` 时递增 `statsRefreshKey` 刷新简报。

## 4. 组件设计

### 4.1 组件拆分规则

顶栏独立组件；简报独立；详情独立页。

### 4.2 通用组件定义

| 组件 | 职责 |
|------|------|
| SubSettingsTopBar | `title`、`onBack`；图标返回无可见文字标签 |
| StatsBriefCard | `refreshKey`、`onOpenDetail`、`variant?` |

### 4.3 页面组件定义

| 组件 | 职责 |
|------|------|
| ReminderSettingsPage | 接收 `themeMode`、`onThemeModeChange`、`statsRefreshKey`、`onOpenStats` |
| StatisticsPage | `onBack`；维度切换与图表 |
| SedentaryReminderSettingsPage / HydrationSettingsPage / QuietHoursSettingsPage | 顶栏标题分别为「久坐提醒」「补水提醒」「免打扰时段」 |

### 4.4 组件Props/State类型定义

- `HomePageProps`: `{ themeMode: ThemeModePreference; onThemeModeChange }`
- `ThemeModePreference`: `'light' | 'dark' | 'system'`

## 5. 接口请求设计

### 5.1 请求封装规范

`invoke` 封装于 `utils/tauri.ts`；失败返回空数组或静默。

### 5.2 与后端1:1对齐的接口请求定义

| 封装函数 | 命令 |
|----------|------|
| recordStatEvent(kind, atMs?) | record_stat_event |
| queryStatEvents(fromMs, toMs) | query_stat_events |

### 5.3 请求/响应拦截规则

无全局拦截；各调用点 try/catch。

### 5.4 异常处理规范

统计失败不弹窗阻断提醒；开发态无 Tauri 时静默。

## 6. 交互流程设计

### 6.1 页面核心交互流程

主题切换立即写 localStorage 并更新根主题；系统主题变化时强制重算有效主题。

### 6.2 加载状态处理

简报与详情 `Card`/`Column` 使用 `loading` 或本地 `loading` state。

### 6.3 异常状态处理

查询结果为空展示「暂无数据」或零柱。

### 6.4 空状态处理

无事件时简报图为空区 + 文案提示。

## 7. 全局状态管理设计

### 7.1 状态管理方案

主题状态在 `App`；`HomePage` 持有 `settingsView`、`statsRefreshKey`、提醒相关 state（与第五版同）。

### 7.2 全局状态定义

| 状态 | 说明 |
|------|------|
| themeMode | 用户偏好 |
| statsRefreshKey | 简报强制刷新 |
| settingsView | 含 stats |

### 7.3 状态更新规则

完成活动/补水统计写入后 `bumpStatsRefresh`；切入 `main` 时 `bumpStatsRefresh`。

## 8. 通用规范设计

### 8.1 样式设计规范

`main`：`maxHeight: calc(100vh - 48px)`，`overflowY: hidden`；非 `main`：`overflowY: auto`。

### 8.2 性能优化规范

避免在 `stats` 页跑枢纽秒级定时器（与第五版一致：`hubNowMs` 仅 `main`）。

### 8.3 兼容性适配规范

`matchMedia` 不可用则跟随系统退化为浅色。

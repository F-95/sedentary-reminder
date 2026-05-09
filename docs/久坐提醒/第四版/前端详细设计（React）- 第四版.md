# 前端详细设计（React）-第四版

> **【已锁定】** 锁定日期：2026-05-09。本文件为久坐提醒第四版基线文档。

## 1. 设计概述

### 1.1 设计目标

实现补水提醒（配置 + 独立定时链 + 系统通知）与免打扰页 Collapse **受控**交互（默认全折叠、新增仅展开新段）；久坐调度与第三版一致。

### 1.2 设计约束

- 不修改 `App.tsx` 全局 `ConfigProvider`。
- 页面级使用 Ant Design `Collapse`/`Switch`/`InputNumber`；禁止深度选择器覆盖 AntD。
- 推迟逻辑在 `quietHours` 可测纯函数中复用。

### 1.3 参考依据（系统总体设计、需求规格说明书、后端详细设计）

《系统总体设计-第四版》《需求规格说明书-第四版》《后端详细设计（Rust）-第四版》《前端详细设计（React）-第三版》。

## 2. 前端目录结构定义

### 2.1 目录层级规范

与第三版一致；不新增目录。

### 2.2 各目录职责定义

| 路径 | 第四版职责 |
|------|------------|
| pages/ReminderSettingsPage.tsx | 主设置；提供「免打扰时段设置」「补水提醒设置」链式入口（先免打扰、后补水） |
| pages/HydrationSettingsPage.tsx | 独立补水页：与免打扰页同构 `Card` + 返回；总开关、`InputNumber` 间隔（1–360）、说明文案 |
| pages/QuietHoursSettingsPage.tsx | `Collapse` 改为受控：`activeKey` + `onChange`；`useState<string[]>([])`；新增后 `setActiveKey` 为 `[新段 id]`；删除时从 keys 剔除 |
| pages/HomePage.tsx | `settingsView`：`main` / `quiet` / `hydration`；补水 `useEffect`：`computeNextIntervalFireWithQuietHours` + `setTimeout` 链；`sendNotification`；清理函数清除 timer |
| utils/quietHours.ts | `postponeCandidatePastQuietHours`（内部或导出供测）、`computeNextIntervalFireWithQuietHours`；`parseReminderConfigV2` 补齐补水字段；重构 `computeNextTriggerWithQuietHours` 调用共用推迟 |
| types/global.d.ts | `ReminderConfig` 增加补水两字段 |

### 2.3 文件命名规则

与项目规范一致。

## 3. 页面路由设计

### 3.1 路由清单总览

`HomePage` 内视图切换：`main`（主设置）/ `quiet`（免打扰）/ `hydration`（补水）；无路由库。

### 3.2 路由权限定义

不适用。

### 3.3 路由跳转规则

主设置 → 免打扰 / 补水子页，子页「返回主界面」回到 `main`；折叠展开不视为路由事件。

## 4. 组件设计

### 4.1 组件拆分规则

补水表单在独立 `HydrationSettingsPage`；免打扰折叠状态为 `QuietHoursSettingsPage` 本地 state。

### 4.2 通用组件定义

第四版不强制新增 `src/components` 通用组件。

### 4.3 页面组件定义

| 组件 | 第四版增量 |
|------|------------|
| ReminderSettingsPage | `onOpenQuietHours` / `onOpenHydration` 入口链接 |
| HydrationSettingsPage | 补水开关与间隔；`onChange` 合并 `ReminderConfig`；`onBack` |
| QuietHoursSettingsPage | 受控 Collapse；`addQuietHour` 与 `removeQuietHourAt` 与 `activeKey` 同步 |
| HomePage | `notifyHydration` 异步函数；补水 timer ref；推迟上限告警 ref；三态 `settingsView` |

### 4.4 组件Props/State类型定义

`ReminderConfig` 扩展两字段；`QuietHoursSettingsPage` 本地 `activeKeys: string[]`（或 `activeKey` 命名与 AntD 一致）。

## 5. 接口请求设计

### 5.1 请求封装规范

不变。

### 5.2 与后端1:1对齐的接口请求定义

补水不调用后端；久坐仍调用 `updateNextTrigger` 等，条件与第三版一致。

### 5.3 请求/响应拦截规则

不变。

### 5.4 异常处理规范

通知权限失败静默；推迟上限 `message.warning` 与久坐同类文案可复用。

## 6. 交互流程设计

### 6.1 页面核心交互流程

- 用户从主设置进入补水页并开启补水、设间隔：持久化；补水 effect 重排程；久坐 next 不变。
- 用户进入免打扰页：全部折叠；新增后仅新段展开；手动点击可展开多段。
- 用户删除段：该段从 `activeKey` 移除。

### 6.2 加载状态处理

与第三版一致。

### 6.3 异常状态处理

补水推迟达上限：告警一次（debounce ref）。

### 6.4 空状态处理

无时段时无 Collapse 列表；与第三版一致。

## 7. 全局状态管理设计

### 7.1 状态管理方案

`ReminderConfig` 仍在 `HomePage`；免打扰折叠 keys 为页面本地 state。

### 7.2 全局状态定义

`ReminderConfig` 单树含补水字段。

### 7.3 状态更新规则

配置不可变更新；补水定时器依赖补水切片 + 免打扰字段。

## 8. 通用规范设计

### 8.1 样式设计规范

与第三版一致；仅用主题与公开 props。

### 8.2 性能优化规范

段数 ≤20；避免不必要 effect 依赖 `config` 全对象。

### 8.3 兼容性适配规范

与第三版时间摘要、跨午夜说明一致。

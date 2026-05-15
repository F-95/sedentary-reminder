# 前端详细设计（React）-第十版

> **【归档基线】** 与实现版本 **v0.1.10** 对齐；归档日期：2026-05-14。

## 1. 设计概述

### 1.1 设计目标

在全屏久坐、主界面底部、久坐子页与调度编排中落地第十版交互与数据策略；通过 **`@tauri-apps/api/event`** 订阅 **`session-unlocked`**；通过 **`invoke`** 读写调度快照。

### 1.2 设计约束

- 全局主题仍 **仅** 在根 `ConfigProvider` 配置；不得为底部须知引入破坏 AntD 全局 token 的写法。
- **`buildSchedulerFingerprint`** 与后端快照 **fingerprint** 字节级一致（UTF-8 JSON 字符串一致）。

### 1.3 参考依据

《系统总体设计-第十版》《后端详细设计（Rust）-第十版》、《前端详细设计（React）-第九版》。

## 2. 前端目录结构定义

### 2.1 目录层级规范

第十版涉及路径（增量）：

- `src/pages/HomePage.tsx`
- `src/pages/ReminderFullscreenPage.tsx`
- `src/pages/SedentaryReminderSettingsPage.tsx`
- `src/utils/quietHours.ts`、`src/utils/quietHours.test.ts`
- `src/utils/tauri.ts`
- `src/types/global.d.ts`

### 2.2 各目录职责定义

| 目录/文件 | 职责 |
|-----------|------|
| `pages/HomePage.tsx` | 快照加载 effect、久坐/补水首轮 merge、`saveSchedulerSnapshot` 调用、`listen(EVENT_SESSION_UNLOCKED)`、底部用户须知 UI |
| `pages/ReminderFullscreenPage.tsx` | `document` 捕获 `contextmenu` + 根 `onContextMenu` |
| `pages/SedentaryReminderSettingsPage.tsx` | `logActivityOnSessionUnlockEnabled` 开关与说明 |
| `utils/quietHours.ts` | `buildSchedulerFingerprint`、配置字段归一化 |
| `utils/tauri.ts` | `EVENT_SESSION_UNLOCKED`、`loadSchedulerSnapshot`、`saveSchedulerSnapshot` 类型与封装 |
| `types/global.d.ts` | `ReminderConfig` 增字段 |

### 2.3 文件命名规则

与项目规范一致：页面 **大驼峰**、工具 **小驼峰**。

## 3. 页面路由设计

### 3.1 路由清单总览

第十版 **无新增路由**；仍为单页内 `settingsView` 状态切换。

### 3.2 路由权限定义

不适用（桌面壳内无鉴权路由）。

### 3.3 路由跳转规则

无变更。

## 4. 组件设计

### 4.1 组件拆分规则

- **用户须知**：置于 `HomePage` 底部栏，**不**拆为 `src/pages` 下可复用业务组件（避免与规范「页面不封装可复用 AntD 业务组件」冲突时，采用 **内联 JSX** 即可；若未来抽到 `src/components`，须按规范命名如 `LocalDataNoticeFooter.tsx`）。

### 4.2 通用组件定义

本版 **不强制** 新增 `src/components` 通用组件。

### 4.3 页面组件定义

| 组件 | 变更要点 |
|------|----------|
| `ReminderFullscreenPage` | `useEffect` + `visible` 依赖注册/卸载 `document` 捕获监听；根 `div` `onContextMenu` |
| `HomePage` | 多 `useRef`：`loadedSchedulerSnapshotRef`、`sedentaryScheduleBootstrapRef`、`hydrationScheduleBootstrapRef`、`nextTriggerAtRef`、`hydrationNextAtRef`、`reminderVisibleRef`；久坐 effect 内 merge 与 `saveSchedulerSnapshot`；补水 `scheduleNext` 内 merge 与 save；`listen` 解锁分支 |
| `SedentaryReminderSettingsPage` | 标题行 `Row` + 说明 `Typography.Paragraph` 次行 |

### 4.4 组件Props/State类型定义

- `ReminderConfig` 增加 **`logActivityOnSessionUnlockEnabled: boolean`**，默认 **`false`**（解析层保证）。
- `SchedulerSnapshotPayload`（`tauri.ts`）与 Rust serde **字段名对齐**。

## 5. 接口请求设计

### 5.1 请求封装规范

- `loadSchedulerSnapshot`：**try/catch** 返回 `null`（与开发态浏览器兼容）。
- `saveSchedulerSnapshot`：**try/catch** 静默（不打断调度主循环）。

### 5.2 与后端1:1对齐的接口请求定义

| 封装函数 | invoke 名 | 参数 | 返回 |
|----------|-------------|------|------|
| `loadSchedulerSnapshot` | `load_scheduler_snapshot` | 无 | `SchedulerSnapshotPayload \| null` |
| `saveSchedulerSnapshot` | `save_scheduler_snapshot` | `{ snapshot }` | `void` |

### 5.3 请求/响应拦截规则

无 axios 层；不适用。

### 5.4 异常处理规范

- invoke 失败：**load** 视为无快照；**save** 静默（须在《测试与验收方案》注明可观测性策略：如可选 `console.warn` 仅开发态——若实现无则写「无用户可见错误」）。

## 6. 交互流程设计

### 6.1 页面核心交互流程

1. **启动**：`useEffect` 异步 `loadSchedulerSnapshot` → 填 `loadedSchedulerSnapshotRef`。
2. **久坐调度 effect**：算 `nextMs` → 若首轮且快照合法则覆盖 → `setNextTriggerAt` → `updateNextTrigger` → `saveSchedulerSnapshot`。
3. **解锁**：`listen` 回调读 `configRef` 与 `reminderVisibleRef` → 条件满足则 `recordStatEvent` + `setSedentaryScheduleNonce` + `message.success`。

### 6.2 加载状态处理

- 快照加载 **无全屏 Loading**；首帧可能短暂用计算值再在下一轮 effect 纠正的设计 **禁止**（实现为首轮 merge 于同一 effect 内完成）。

### 6.3 异常状态处理

- 快照损坏：等价无快照。
- 指纹不一致：丢弃快照语义。

### 6.4 空状态处理

- `sedentaryNextAtMs` 为 `null`：枢纽展示与第九版「未启用」语义一致。

## 7. 全局状态管理设计

### 7.1 状态管理方案

仍以 **React `useState` + `useRef` + `useEffect`** 为主；**无** Redux 引入。

### 7.2 全局状态定义

- 快照 **非** React state，存 **`useRef`**，避免不必要重渲染。

### 7.3 状态更新规则

- `sedentaryScheduleBootstrapRef`：久坐调度 effect **每次执行末尾** 置 `false`（与实现一致时以代码为准；设计意图为 **仅首轮可 merge**）。

## 8. 通用规范设计

### 8.1 样式设计规范

- 底部须知：`Typography.Text type="secondary"` `fontSize: 12`；`InfoCircleOutlined` 与 **`Tooltip`** 搭配。
- 久坐子页：标题与 `Switch` 同一 `Row` `justify="space-between"`。

### 8.2 性能优化规范

- `document` 级 `contextmenu` 监听 **仅** `visible===true` 期间存在。

### 8.3 兼容性适配规范

- 浏览器纯跑（无 Tauri）：`listen`/`invoke` 失败路径已容错。

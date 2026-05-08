# 前端详细设计（React）-第一版

## 1. 设计概述

### 1.1 设计目标

实现久坐提醒主界面：承载提醒配置编辑、下次触发调度、全屏提醒视图、系统通知兜底、托盘事件响应与关闭行为偏好。

### 1.2 设计约束

- 全局主题仅在 `App.tsx` 的 `ConfigProvider` 配置。
- 页面级组件直接使用 Ant Design 原生组件；通用可复用封装组件放入 `src/components/`（第一版仅示例性质组件存在）。
- 禁止在页面目录封装可复用的重型 AntD 业务组件。

### 1.3 参考依据（系统总体设计、需求规格说明书、后端详细设计）

《系统总体设计-第一版》《需求规格说明书-第一版》《后端详细设计（Rust）-第一版》。

## 2. 前端目录结构定义

### 2.1 目录层级规范

- `src/App.tsx`：根布局、主题、插件宿主占位。
- `src/pages/HomePage.tsx`：主页面与调度逻辑。
- `src/pages/ReminderSettingsPage.tsx`：设置表单区域。
- `src/pages/ReminderFullscreenPage.tsx`：全屏提醒呈现。
- `src/utils/tauri.ts`：Tauri 调用封装与事件常量。
- `src/types/global.d.ts`：全局类型声明。

### 2.2 各目录职责定义

| 目录 | 职责 |
|------|------|
| pages | 路由级页面，聚合交互 |
| utils | 调用后端命令、常量 |
| types | 领域类型声明 |
| components | 轻量通用按钮等复用件 |
| plugins | 插件宿主加载器（第一版非提醒核心） |

### 2.3 文件命名规则

页面文件大驼峰；工具文件小驼峰。

## 3. 页面路由设计

### 3.1 路由清单总览

第一版未引入 `react-router`；单页仅渲染 `HomePage`，提醒全屏以覆盖层组件形式存在于同页。

| 逻辑视图 | 实现方式 |
|----------|----------|
| 主设置视图 | `HomePage` + `ReminderSettingsPage` |
| 全屏提醒视图 | `ReminderFullscreenPage` `visible` 控制 |

### 3.2 路由权限定义

不适用（无登录与角色）。

### 3.3 路由跳转规则

无页面级路由跳转；通过本地状态切换可见性。

## 4. 组件设计

### 4.1 组件拆分规则

- 设置项独立为 `ReminderSettingsPage` 以便阅读维护。
- 全屏视图独立以隔离动画与布局负担。

### 4.2 通用组件定义

- `PrimaryButton`：示例外壳封装，提醒流程主要直接使用 AntD `Button`。

### 4.3 页面组件定义

| 组件 | 职责 |
|------|------|
| HomePage | 配置状态容器、定时器调度、事件监听、提醒触发 orchestration |
| ReminderSettingsPage | 展示与编辑 `ReminderConfig` 子集 |
| ReminderFullscreenPage | 全屏提醒 UI、活动按钮、倒计时展示 |

### 4.4 组件Props/State类型定义

- `ReminderSettingsPageProps`：`config: ReminderConfig`、`nextTriggerLabel: string`、`onChange(next): void`。
- `HomePage` 内部状态：`config`、`nextTriggerAt`、`reminderVisible`、`isCounting`、`remainSeconds`、`currentText`、`cardAnchor`、关闭提示框状态等。

## 5. 接口请求设计

### 5.1 请求封装规范

- 统一通过 `src/utils/tauri.ts` 的方法封装 `invoke`，禁止页面散落硬编码命令名字符串（新增命令须在此集中扩展）。

### 5.2 与后端1:1对齐的接口请求定义

| 封装函数 | 调用名 | 参数映射 |
|----------|--------|----------|
| setReminderWindowMode | set_reminder_window_mode | active |
| updateNextTrigger | update_next_trigger | triggerAtMs, triggerLabel |
| startReminderSession | start_reminder_session | sessionId |
| finishActivityAndLock | finish_activity_and_lock | sessionId, lockEnabled |
| getReminderRuntime | get_reminder_runtime | 无 |
| listDefaultSlogans | list_default_slogans | 无 |
| setAutoStartEnabled | set_auto_start | enabled |
| syncTrayMenu | sync_tray_menu | autoStart, reminderEnabled, lockOnFinish |
| exitApp | exit_app | 无 |

### 5.3 请求/响应拦截规则

第一版无统一 axios 层；Tauri `invoke` 失败直接在各调用处 `catch` 并使用 `message` 反馈。

### 5.4 异常处理规范

- 托盘监听注册失败静默跳过（兼容非 Tauri 环境）。
- 窗口模式切换失败：中止提醒可见状态并提示错误。

## 6. 交互流程设计

### 6.1 页面核心交互流程

用户修改配置 → 即时写入 `localStorage` → 同步托盘 → 重新计算下次触发 → 到达触发 → 全屏提醒 → 开始活动 → 倒计时 → 结束活动 → 可选锁屏 → 回到设置视图。

### 6.2 加载状态处理

第一版无远程配置加载圈；默认标语异步加载不改变阻塞主 UI。

### 6.3 异常状态处理

- 铃声播放失败：警告提示。
- 通知权限拒绝：静默跳过。

### 6.4 空状态处理

文案列表若被过滤为空则使用内置兜底字符串常量。

## 7. 全局状态管理设计

### 7.1 状态管理方案

采用 React 内置 `useState` / `useEffect` / `useMemo`；不使用 Redux 或 MobX。

### 7.2 全局状态定义

- **ReminderConfig**：唯一业务配置状态，存在于 `HomePage`。
- **关闭行为偏好**：存 `localStorage` 键 `close-behavior-v1`。

### 7.3 状态更新规则

- 配置更新必须通过 `setConfig` 合并不可变对象。
- 托盘事件更新配置时需保持其他字段不变。

## 8. 通用规范设计

### 8.1 样式设计规范

- 主题色 token：`colorPrimary` 固定蓝色系示例值；圆角 token 统一。
- 页面使用 `Layout` 包裹，`Content` 内边距 24px。

### 8.2 性能优化规范

- 定时器在依赖变更时清理，避免泄漏。
- 随机文案选择使用简单随机数即可。

### 8.3 兼容性适配规范

- 时间展示使用 `toLocaleString("zh-CN")`。
- 兜底触发监听 `visibilitychange` 与 `focus`。

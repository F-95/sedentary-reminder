# 前端详细设计（React）-第五版

> **【已锁定】** 锁定日期：2026-05-09。本文件为久坐提醒第五版基线文档。

## 1. 设计概述

### 1.1 设计目标

实现主设置**枢纽页**（开机启动、久坐/补水下次时间与倒计时、纵向子页入口、分时段单行 Card 标题）；新增**久坐提醒**独立设置页并迁出原主表单中的久坐字段；扩展 `HomePage` 视图状态与补水 next 镜像及主视图秒级时钟；久坐与补水调度逻辑与第四版一致。

### 1.2 设计约束

- 不修改 `App.tsx` 全局 `ConfigProvider`。
- 页面级使用 Ant Design 公开 API；禁止深度选择器覆盖 AntD。
- 时段标题为单行文本展示，允许 `ellipsis` 截断，禁止标题内手动换行。

### 1.3 参考依据（系统总体设计、需求规格说明书、后端详细设计）

《系统总体设计-第五版》《需求规格说明书-第五版》《后端详细设计（Rust）-第五版》《前端详细设计（React）-第四版》。

## 2. 前端目录结构定义

### 2.1 目录层级规范

与第四版一致；不新增目录层级。

### 2.2 各目录职责定义

| 路径 | 第五版职责 |
|------|------------|
| pages/ReminderSettingsPage.tsx | **枢纽**：Card 标题为分时段单行关怀文案；正文首行开机启动；久坐/补水各「下次提醒时间」「倒计时」；纵向入口：久坐提醒设置、补水提醒设置、免打扰时段设置 |
| pages/SedentaryReminderSettingsPage.tsx | **新增**：久坐业务表单（启用提醒、提醒结束后锁屏、提醒间隔、活动倒计时、随机文案与文案列表）；Card 标题「久坐提醒」；返回主界面 |
| pages/HydrationSettingsPage.tsx | 与第四版一致 |
| pages/QuietHoursSettingsPage.tsx | 与第四版一致 |
| pages/HomePage.tsx | `settingsView`：`main` / `sedentary` / `hydration` / `quiet`；状态 `hydrationNextAt`、`hubNowMs`；`main` 时 `setInterval` 每秒更新 `hubNowMs`；补水 effect 在排程时同步 `setHydrationNextAt`，关闭补水时置空；条件渲染久坐独立页 |
| utils/quietHours.ts | 与第四版一致 |
| types/global.d.ts | 与第四版一致（无新字段） |

### 2.3 文件命名规则

与项目规范一致；新增页为大驼峰 `SedentaryReminderSettingsPage.tsx`。

## 3. 页面路由设计

### 3.1 路由清单总览

`HomePage` 内视图切换：`main`（枢纽）/ `sedentary`（久坐设置）/ `hydration`（补水）/ `quiet`（免打扰）；无路由库。

### 3.2 路由权限定义

不适用。

### 3.3 路由跳转规则

枢纽纵向链 → 对应子页；各子页「返回主界面」→ `main`。秒级定时器仅在 `main` 运行。

## 4. 组件设计

### 4.1 组件拆分规则

久坐表单仅在 `SedentaryReminderSettingsPage`；枢纽不包含久坐表单控件。

### 4.2 通用组件定义

第五版不强制新增 `src/components` 通用组件。

### 4.3 页面组件定义

| 组件 | 第五版职责 |
|------|------------|
| ReminderSettingsPage | 接收 `config`、`nextSedentaryAt`、`nextHydrationAt`、`nowMs`、`sedentaryFullscreenActive`、`onChange`、三个 `onOpen*`；渲染枢纽布局与分时段标题 |
| SedentaryReminderSettingsPage | 接收 `config`、`onChange`、`onBack` |
| HydrationSettingsPage | 同第四版 |
| QuietHoursSettingsPage | 同第四版 |
| HomePage | 组装四视图；向枢纽传入 `nextTriggerAt` 作为久坐 next、`hydrationNextAt`、`hubNowMs`、`reminderVisible` 映射为全屏进行中标志 |

### 4.4 组件Props/State类型定义

- 枢纽：`nextSedentaryAt` 与 `nextHydrationAt` 为毫秒时间戳或空；`nowMs` 为展示用当前毫秒。
- 分时段标题：由本地小时映射到单行字符串的纯函数，输入建议为 `Date` 自 `nowMs` 推导的小时。
- 倒计时格式化：基于 `max(0, nextAt - nowMs)`；剩余为零或已过期可展示「即将提醒」；全屏进行中时久坐倒计时为约定占位。

## 5. 接口请求设计

### 5.1 请求封装规范

不变。

### 5.2 与后端1:1对齐的接口请求定义

久坐仍调用 `updateNextTrigger` 等，条件与第四版一致；补水不调用后端；枢纽不新增 invoke。

### 5.3 请求/响应拦截规则

不变。

### 5.4 异常处理规范

与第四版一致；开机启动失败仍 `message.error`。

## 6. 交互流程设计

### 6.1 页面核心交互流程

- 用户进入应用默认 `main`：见双通道摘要与纵向入口；标题随时段变化。
- 用户打开久坐子页并修改间隔：持久化；久坐 effect 重算 next；补水摘要不受影响（未改补水字段时）。
- 用户停留在子页：枢纽定时器停止；返回 `main` 后立即刷新一次展示时钟。

### 6.2 加载状态处理

与第四版一致。

### 6.3 异常状态处理

推迟上限告警与第四版一致。

### 6.4 空状态处理

久坐未启用或 next 为空时枢纽展示约定「未启用」或「—」；补水关闭时同理会。

## 7. 全局状态管理设计

### 7.1 状态管理方案

`ReminderConfig` 仍在 `HomePage`；`hydrationNextAt` 与 `hubNowMs` 为 `HomePage` 本地 state；免打扰折叠 keys 仍为免打扰页本地 state。

### 7.2 全局状态定义

| 状态 | 说明 |
|------|------|
| settingsView | `main` \| `sedentary` \| `hydration` \| `quiet` |
| hydrationNextAt | 补水下一拍目标时刻，与定时器一致 |
| hubNowMs | 枢纽倒计时与标题时段判定用 |

### 7.3 状态更新规则

`hubNowMs` 仅 `main` 下每秒更新；配置仍不可变合并更新。

## 8. 通用规范设计

### 8.1 样式设计规范

与第四版一致；枢纽链接使用纵向 `Space`；Card 标题区域单行省略。

### 8.2 性能优化规范

避免在子页挂载秒级 interval；effect 依赖仍避免全 `config` 对象引用导致误重建。

### 8.3 兼容性适配规范

与第四版本地时间、跨午夜免打扰说明一致。

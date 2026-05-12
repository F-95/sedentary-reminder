# 前端详细设计（React）-第八版

> **【已锁定】** 锁定日期：2026-05-12。

## 1. 设计概述

### 1.1 设计目标

落地枢纽久坐区 **记录活动** / **跳过本次**、久坐调度手动重排、统计双序列与四类合计、活动统计页情绪简报、嵌入简报与分桶工具升级；类型定义扩展 `StatEventKind`。

### 1.2 设计约束

- 不修改根 `ConfigProvider` 主题策略（第七版已定）。
- 统计图使用 @ant-design/plots 堆叠柱图；禁止深度选择器覆盖 Ant Design 组件。
- 情绪简报为纯函数模块输出字符串，禁止 `invoke` 外部生成式服务。

### 1.3 参考依据（系统总体设计、需求规格说明书、后端详细设计）

《系统总体设计-第八版》《需求规格说明书-第八版》《后端详细设计（Rust）-第八版》《前端详细设计（React）-第七版》。

## 2. 前端目录结构定义

### 2.1 目录层级规范

与项目规范一致。

### 2.2 各目录职责定义

| 路径 | 第八版职责 |
|------|------------|
| `types/global.d.ts` | `StatEventKind` 增加 `sedentary_activity_logged`、`sedentary_skipped` |
| `utils/tauri.ts` | **无 API 签名变更**；继续封装 `recordStatEvent`、`queryStatEvents` |
| `utils/statsBuckets.ts` | `BucketDatum` 改为活动合并与跳过两字段；`buildDetailBuckets`、`briefLast7DaysActivityStacks`、今日/本周活动与跳过计数、`aggregateWindowTotals`、`peakActivityMergedBucketLabel`、`queryRangeForDimension` |
| `utils/statsEmotionalBrief.ts` | **新增**：`buildEmotionalStatsBrief(dimension, totals, peakBucketLabel)` 等 |
| `pages/HomePage.tsx` | `sedentaryScheduleNonce` 状态；久坐调度 effect 依赖含 nonce；`handleSedentaryLogActivity` / `handleSedentarySkipOnce`；向枢纽传入回调 |
| `pages/ReminderSettingsPage.tsx` | 久坐区块 `Row`+`Col` 布局；两 `Button`；props `onSedentaryLogActivity`、`onSedentarySkipOnce` |
| `pages/StatisticsPage.tsx` | 双序列 `chartFlat`、四类合计、`briefText` 状态；图下 `Typography.Paragraph` |
| `components/StatsBriefCard.tsx` | 近 7 日双序列堆叠；副标题今日/本周活动与跳过 |

### 2.3 文件命名规则

与项目规范一致；新增工具文件小驼峰 `statsEmotionalBrief.ts`。

## 3. 页面路由设计

### 3.1 路由清单总览

与第七版相同：`HomePage` 内 `main` / `sedentary` / `hydration` / `quiet` / `stats` / `author`；第八版不增路由键。

### 3.2 路由权限定义

不适用。

### 3.3 路由跳转规则

与第七版一致；进入 `stats` 时拉取当前维度时间窗事件并生成简报。

## 4. 组件设计

### 4.1 组件拆分规则

情绪简报逻辑独立为 `utils/statsEmotionalBrief`，页面仅负责展示与刷新触发。

### 4.2 通用组件定义

与第七版一致；第八版不新增可复用业务组件文件（简报为工具函数）。

### 4.3 页面组件定义

| 组件 | 职责 |
|------|------|
| ReminderSettingsPage | 久坐区布局与按钮禁用条件；触发父回调 |
| HomePage | 写统计、刷新简报 key、递增 nonce、成功/失败 message |
| StatisticsPage | Segmented 维度、拉取事件、构建 `chartFlat`、合计、简报 |
| StatsBriefCard | 近 7 日查询、双序列图、副标题指标 |

### 4.4 组件Props/State类型定义

| 名称 | 说明 |
|------|------|
| ReminderSettingsPageProps | 在第七版基础上增加 `onSedentaryLogActivity: () => void`、`onSedentarySkipOnce: () => void` |
| HomePage 本地状态 | `sedentaryScheduleNonce: number`（初值 0，点击成功路径递增） |
| StatisticsPage 本地状态 | `chartFlat`、`windowTotals`（或等价结构）、`briefText`、`loading`、`dimension` |

## 5. 接口请求设计

### 5.1 请求封装规范

与第七版一致；封装函数仍通过 `@tauri-apps/api/core` invoke。

### 5.2 与后端1:1对齐的接口请求定义

| 前端封装 | Tauri 命令 | 第八版说明 |
|----------|------------|------------|
| recordStatEvent | record_stat_event | `kind` 传 `sedentary_activity_logged` 或 `sedentary_skipped` |
| queryStatEvents | query_stat_events | 时间窗由 `queryRangeForDimension` 计算 |

### 5.3 请求/响应拦截规则

不适用新增。

### 5.4 异常处理规范

写统计失败：错误 message，不递增 nonce；成功路径：成功 message → 刷新简报 → nonce 递增。

## 6. 交互流程设计

### 6.1 页面核心交互流程

枢纽点击记录或跳过 → 成功提示 → 下次时间与倒计时更新；活动统计切换维度 → 图与合计与简报刷新。

### 6.2 加载状态处理

`StatisticsPage` Card 使用 `loading`；简报与图同一数据批次生成完成后结束 loading。

### 6.3 异常状态处理

拉取事件失败：由既有错误处理策略展示（若当前实现为控制台+空数据，第八版不强制改为 Modal，但须在测试中可感知）。

### 6.4 空状态处理

当 `chartFlat` 无数据点时可展示「暂无数据」（与实现一致）；简报可在无数据时省略或展示兜底句（由 `statsEmotionalBrief` 约定）。

## 7. 全局状态管理设计

### 7.1 状态管理方案

与第七版一致；无 Redux 引入。

### 7.2 全局状态定义

| 状态 | 说明 |
|------|------|
| sedentaryScheduleNonce | 仅 `HomePage` 持有，用于触发久坐调度 effect |
| statsRefreshKey | 继承第七版，写统计后递增以刷新 `StatsBriefCard` |

### 7.3 状态更新规则

与第七版一致；`nonce` 仅在手动操作成功路径递增，避免无效重排。

## 8. 通用规范设计

### 8.1 样式设计规范

久坐区 `Row` 使用 `gutter` 与 `align="top"`；按钮 `size="small"`；堆叠图颜色与 Ant Design token 协调（建议使用蓝色系与橙色区分两序列，避免红绿语义混淆）。

### 8.2 性能优化规范

`statsBuckets` 内过滤在测试可接受范围内实现；大数据量时后续可优化为单次遍历分桶（非第八版强制）。

### 8.3 兼容性适配规范

与第七版一致。

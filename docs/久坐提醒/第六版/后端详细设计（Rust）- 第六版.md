# 后端详细设计（Rust）-第六版

> **【已锁定】** 锁定日期：2026-05-09。

## 1. 设计概述

### 1.1 设计目标

提供**本地统计事件**的追加与按时间窗查询；文件位于应用数据目录，保留约 400 天。

### 1.2 设计约束

- 不引入数据库 crate；使用 JSONL + 整文件重写。
- 命令注册于 `main.rs` `generate_handler!`；模块路径 `commands/stats.rs`。

### 1.3 参考依据（系统总体设计、需求规格说明书）

《系统总体设计-第六版》《需求规格说明书-第六版》。

## 2. 后端目录结构定义

### 2.1 目录层级规范

新增 `src-tauri/src/commands/stats.rs`；`commands/mod.rs` 导出 `stats` 子模块。

### 2.2 各目录职责定义

| 路径 | 第六版职责 |
|------|------------|
| commands/stats.rs | 统计文件路径、`record_stat_event`、`query_stat_events`、保留期裁剪、单元测试 |

### 2.3 文件命名规则

`stats.rs` 小写 + 下划线。

## 3. 接口详细设计

### 3.1 接口清单总览

| 命令 | 说明 |
|------|------|
| record_stat_event | 追加事件并裁剪 |
| query_stat_events | 闭区间查询 |

### 3.2 单个接口详细定义（表格化：请求路径、请求方法、请求参数、响应格式、错误码、权限要求）

#### record_stat_event

| 项目 | 内容 |
|------|------|
| 命令名 | `record_stat_event` |
| 参数 | `kind: String`（事件类型）；`at_ms: Option<i64>`（缺省为当前时间毫秒） |
| 响应 | `Result<(), String>` |
| 错误 | 目录创建/读写/序列化失败返回描述字符串 |
| 权限 | `default` capability |

#### query_stat_events

| 项目 | 内容 |
|------|------|
| 命令名 | `query_stat_events` |
| 参数 | `from_ms: i64`、`to_ms: i64`（闭区间） |
| 响应 | `Result<Vec<StatEventRecord>, String>`，`StatEventRecord { kind, at_ms }`，JSON 序列化驼峰 |
| 错误 | 同文件 IO |
| 权限 | `default` capability |

### 3.3 接口通用处理规则

读取时跳过无法解析的行；裁剪以当前时间减去保留毫秒数为下限。

## 4. 数据库详细设计

### 4.1 数据表清单总览

不适用。

### 4.2 单个数据表详细定义

不适用。

### 4.3 索引设计规范

不适用。

### 4.4 事务控制规则

单进程写；无显式事务；并发写冲突概率忽略。

## 5. 核心业务逻辑设计

### 5.1 核心业务流程步骤

1. `record`：读全文件 → 解析 → 裁剪 → 追加 → 排序 → 重写。
2. `query`：读全文件 → 解析 → 裁剪 → 过滤时间窗。

### 5.2 业务逻辑处理规则

事件类型为自由字符串，约定三种：`sedentary_completed`、`sedentary_triggered`、`hydration_notified`。

### 5.3 异常处理流程

任一步失败返回 `Err`；由前端决定是否提示。

## 6. Tauri命令定义

### 6.1 Tauri命令清单

第五版全部命令 + `record_stat_event`、`query_stat_events`。

### 6.2 单个命令详细定义（命令名称、入参、出参、权限、使用场景）

见 3.2；**使用场景**：前端在完成活动、全屏弹出、补水通知成功后写入；简报与详情查询。

### 6.3 命令安全校验规则

无用户身份；依赖 OS 应用沙箱与本地文件权限。

## 7. 通用规范设计

### 7.1 错误处理规范

统一 `Result<(), String>` / `Result<Vec<_>, String>`。

### 7.2 日志埋点规范

第六版不要求结构化日志；可选 `eprintln` 不在本版范围。

### 7.3 性能优化规范

事件量级较小时全量读写可接受；后续可按大小分片。

### 7.4 安全防护规范

路径拼接限定在 `app_data_dir` 下固定文件名 `reminder_stats.jsonl`。

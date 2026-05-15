# 后端详细设计（Rust）-第十版

> **【归档基线】** 与实现版本 **v0.1.10** 对齐；归档日期：2026-05-14。

## 1. 设计概述

### 1.1 设计目标

提供 **调度快照** 的落盘与读取能力；在 **Windows / macOS** 上桥接 **会话解锁** 为 Tauri **全局事件** `session-unlocked`；与第九版命令体系 **无破坏性** 合并。

### 1.2 设计约束

- 不修改 `extensions/` 下核心扩展实现。
- 快照路径仅允许 **`app_data_dir()` 下固定文件名**。
- Windows 会话通知注册失败须 **可诊断错误字符串**；不得 `panic!` 于 `setup` 主路径。

### 1.3 参考依据

《系统总体设计-第十版》《需求规格说明书-第十版》、Tauri 2 `Manager` / `Emitter` 文档、`windows` crate、`core-foundation-sys` 文档。

## 2. 后端目录结构定义

### 2.1 目录层级规范

```
src-tauri/src/
├── commands/
│   ├── scheduler_snapshot.rs   # 第十版新增：快照读写命令
│   └── mod.rs                  # 导出 scheduler_snapshot
├── platform/
│   ├── session_unlock.rs       # 第十版新增：会话解锁监听
│   └── mod.rs                  # cfg 导出 session_unlock
└── main.rs                     # setup 注册监听 + invoke_handler 注册命令
```

### 2.2 各目录职责定义

| 路径 | 职责 |
|------|------|
| `commands/scheduler_snapshot.rs` | JSON 快照序列化、路径解析、错误字符串 |
| `platform/session_unlock.rs` | 分平台 `install_session_unlock_listener`、事件名常量、`emit` |
| `main.rs` | `setup` 调用安装函数；失败 `eprintln!` 不阻断托盘 |

### 2.3 文件命名规则

- 模块文件 **小写 + 下划线**：`scheduler_snapshot.rs`、`session_unlock.rs`。
- JSON 文件名：**`scheduler_snapshot.json`**（与代码常量一致）。

## 3. 接口详细设计

### 3.1 接口清单总览

| 接口类型 | 名称 | 说明 |
|----------|------|------|
| Tauri Command | `load_scheduler_snapshot` | 读快照，可选无文件 |
| Tauri Command | `save_scheduler_snapshot` | 覆盖写快照 |
| 进程内事件 | `session-unlocked` | 由 Rust `emit`，非 invoke |

### 3.2 单个接口详细定义

#### load_scheduler_snapshot

| 项目 | 内容 |
|------|------|
| 命令名 | `load_scheduler_snapshot` |
| 请求方法 | Tauri Command（invoke） |
| 请求参数 | 无 |
| 响应格式 | `Option<SchedulerSnapshot>`，JSON camelCase |
| 错误码 | `Err(String)`：目录创建失败、读失败、JSON 反序列化失败 |
| 权限要求 | `default` capability 已包含之业务命令集 |

**SchedulerSnapshot 字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| schemaVersion | u32 | 当前为 **1** |
| fingerprint | String | 与前端 `buildSchedulerFingerprint` 输出一致 |
| sedentaryNextAtMs | Option\<i64\> | 久坐下一拍 Unix 毫秒；禁用或无排程可为 null |
| hydrationNextAtMs | Option\<i64\> | 补水下一拍 Unix 毫秒；关闭补水可为 null |

#### save_scheduler_snapshot

| 项目 | 内容 |
|------|------|
| 命令名 | `save_scheduler_snapshot` |
| 请求方法 | Tauri Command |
| 请求参数 | `snapshot: SchedulerSnapshot`（整体对象，camelCase） |
| 响应格式 | `Result<(), String>` |
| 错误码 | 序列化失败、写盘失败 |
| 权限要求 | 同 load |

#### session-unlocked（事件）

| 项目 | 内容 |
|------|------|
| 事件名 | `session-unlocked`（常量 `EVENT_SESSION_UNLOCKED`） |
| 载荷 | 当前实现为 **空 JSON 对象** `{}`（可扩展 `atMs`） |
| 触发条件 | Windows：`WM_WTSSESSION_CHANGE` 且 `wParam == WTS_SESSION_UNLOCK`；macOS：Darwin 回调 |
| 监听方 | 前端 `listen` |

### 3.3 接口通用处理规则

- 路径：`app.path().app_data_dir()` → `create_dir_all` → `join("scheduler_snapshot.json")`。
- 写盘使用 **`serde_json::to_vec_pretty`** 便于人工 diff（体量小）。
- **`main.rs` setup**：`install_session_unlock_listener(&app.handle())` 仅记录失败，**不** `?` 终止应用启动。

## 4. 数据库详细设计

### 4.1 数据表清单总览

本版本 **无新增关系型数据库表**；持久化仍为 **文件型** 实体。

### 4.2 单个数据表详细定义

不适用（N/A）。

### 4.3 索引设计规范

不适用（N/A）。

### 4.4 事务控制规则

- 快照写为 **单文件覆盖写**（非追加）；与 JSONL 统计 **无跨文件事务**；以 **最后一次 save 为准**。

## 5. 核心业务逻辑设计

### 5.1 核心业务流程步骤

1. **启动**：`setup` → `session_unlock::install_session_unlock_listener`。
2. **Windows**：取 `main` 窗口 `HWND` → `WTSRegisterSessionNotification` → `SetWindowSubclass` → 在 `session_subclass_proc` 中检测解锁 → `app.emit`。
3. **macOS**：`CFNotificationCenterGetDarwinNotifyCenter` → `CFNotificationCenterAddObserver` → 回调 `emit`。
4. **快照 load**：文件不存在返回 `Ok(None)`；空文件视为无快照。
5. **快照 save**：整文件重写。

### 5.2 业务逻辑处理规则

- **OnceLock\<AppHandle\>**（或等价）保存 `AppHandle` 供子类 / 回调 `emit`；须在 `install` 首次成功路径赋值。
- **WTS** 注册失败时 **回滚**：若子类化失败须 `WTSUnRegisterSessionNotification`（与实现对齐）。

### 5.3 异常处理流程

| 异常 | 处理 |
|------|------|
| 无 main 窗口 | `install` 返回 `Err` |
| hwnd 获取失败 | `Err` 字符串 |
| JSON 损坏 | load 返回 `Err` 由调用方决定；推荐前端映射为 null |

## 6. Tauri命令定义

### 6.1 Tauri命令清单

| 命令 | 说明 |
|------|------|
| `load_scheduler_snapshot` | 读 `scheduler_snapshot.json` |
| `save_scheduler_snapshot` | 写 `scheduler_snapshot.json` |

### 6.2 单个命令详细定义

见 **§3.2** 表格。

### 6.3 命令安全校验规则

- **不**接受任意路径参数；路径 **硬编码** 于模块内。
- 快照内容 **无** 可执行载荷；反序列化类型固定为 `SchedulerSnapshot`。

## 7. 通用规范设计

### 7.1 错误处理规范

- 对外字符串 **中文为主**；关键英文标识（如 `WTSRegisterSessionNotification`）可保留在括号内辅助排障。

### 7.2 日志埋点规范

- `setup` 监听失败：**stderr** 行（`eprintln!`），前缀 `[sedentary-reminder]`。
- 不在热路径 **每秒** 打日志。

### 7.3 性能优化规范

- 快照读写 **同步** 调用即可；避免在子类过程内 **额外磁盘 IO**。

### 7.4 安全防护规范

- 子类过程 **仅** 处理 `WM_WTSSESSION_CHANGE` 分支；其余 **透传** `DefSubclassProc`。
- macOS 回调 **不得** 假设在 JS 线程；`emit` 须符合 Tauri 线程模型（与当前实现一致）。

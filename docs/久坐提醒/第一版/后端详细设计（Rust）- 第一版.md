# 后端详细设计（Rust）-第一版

## 1. 设计概述

### 1.1 设计目标

提供 Tauri 命令层封装窗口协同、提醒运行时镜像、系统托盘联动、Windows 平台系统能力与扩展列举占位；保证线程安全的状态访问与错误字符串对外一致性。

### 1.2 设计约束

- 核心业务配置不以 SQLite 或其他嵌入式数据库持久化在后端。
- 扩展目录 `extensions` 模块禁止在第一版迭代中擅自重构。
- Windows 特定调用需在注释中标明线程与句柄生命周期假设。

### 1.3 参考依据（系统总体设计、需求规格说明书）

《系统总体设计-第一版》《需求规格说明书-第一版》。

## 2. 后端目录结构定义

### 2.1 目录层级规范

- `src-tauri/src/main.rs`：应用入口、命令注册表、窗口关闭事件拦截。
- `src-tauri/src/commands/`：命令模块（`app`、`reminder`、`patch`、`plugin`）。
- `src-tauri/src/core/`：`AppState`、`ReminderRuntimeState`、锁屏封装。
- `src-tauri/src/tray.rs`：托盘 setup 与事件。
- `src-tauri/src/platform/`：Windows 企业层实现（条件编译）。

### 2.2 各目录职责定义

| 路径 | 职责 |
|------|------|
| commands/app.rs | 应用信息、开机自启、托盘勾选同步、退出进程 |
| commands/reminder.rs | 强制窗口模式、运行时更新、会话起止、默认标语 |
| commands/patch.rs | 补丁列举占位 |
| commands/plugin.rs | 插件列举占位 |
| core/app_state.rs | 全局状态容器 |
| core/reminder_scheduler.rs | 提醒运行时结构体定义 |
| core/reminder_lock.rs | 锁屏命令封装 |
| tray.rs | 托盘菜单与 tooltip |

### 2.3 文件命名规则

Rust 源文件使用蛇形命名（snake_case），与模块树一致。

## 3. 接口详细设计

### 3.1 接口清单总览

| 接口标识 | 类型 | 说明 |
|----------|------|------|
| get_app_info | Tauri Command | 返回应用元信息 |
| set_auto_start | Tauri Command | 设置 Windows 开机自启 |
| sync_tray_menu | Tauri Command | 同步托盘勾选与运行时启用镜像 |
| exit_app | Tauri Command | 退出进程 |
| list_patches | Tauri Command | 列举补丁 |
| list_plugins | Tauri Command | 列举插件 |
| set_reminder_window_mode | Tauri Command | 切换强制提醒窗口模式 |
| update_next_trigger | Tauri Command | 更新下次触发时间与标签 |
| start_reminder_session | Tauri Command | 标记活动会话开始 |
| finish_activity_and_lock | Tauri Command | 结束活动并可触发锁屏 |
| get_reminder_runtime | Tauri Command | 查询运行时快照 |
| list_default_slogans | Tauri Command | 返回内置默认文案列表 |

### 3.2 单个接口详细定义（表格化：请求路径、请求方法、请求参数、响应格式、错误码、权限要求）

> 说明：Tauri 场景下无 HTTP Path；下列「调用名」即 invoke 名称。

#### get_app_info

| 项目 | 内容 |
|------|------|
| 调用名 | get_app_info |
| 请求参数 | 无 |
| 响应格式 | JSON 对象：`name`（字符串）、`version`（字符串）、`appId`（字符串，驼峰序列化） |
| 错误码 | 无（不返回 Result） |
| 权限要求 | 本地进程默认可用 |

#### set_auto_start

| 项目 | 内容 |
|------|------|
| 调用名 | set_auto_start |
| 请求参数 | `enabled`：布尔 |
| 响应格式 | 单元成功或字符串错误 |
| 错误码 | 字符串描述（注册表打开失败、写入失败等）；非 Windows 返回不支持 |
| 权限要求 | 当前用户注册表写权限 |

#### sync_tray_menu

| 项目 | 内容 |
|------|------|
| 调用名 | sync_tray_menu |
| 请求参数 | `autoStart`、`reminderEnabled`、`lockOnFinish`：布尔 |
| 响应格式 | 单元成功或字符串错误 |
| 错误码 | 托盘状态未初始化时静默成功；句柄更新失败返回描述字符串 |
| 权限要求 | 本地进程默认可用 |

#### exit_app

| 项目 | 内容 |
|------|------|
| 调用名 | exit_app |
| 请求参数 | 无 |
| 响应格式 | 无（进程退出） |
| 错误码 | 无 |
| 权限要求 | 本地进程默认可用 |

#### set_reminder_window_mode

| 项目 | 内容 |
|------|------|
| 调用名 | set_reminder_window_mode |
| 请求参数 | `active`：布尔 |
| 响应格式 | 单元成功或字符串错误 |
| 错误码 | 窗口查找失败、显示器枚举失败、Windows 企业层调用失败等 |
| 权限要求 | 本地 GUI 权限；涉及 Windows 特定 API |

#### update_next_trigger

| 项目 | 内容 |
|------|------|
| 调用名 | update_next_trigger |
| 请求参数 | `triggerAtMs`：可选 64 位整数毫秒时间戳；`triggerLabel`：可选字符串 |
| 响应格式 | 单元成功或字符串错误 |
| 错误码 | 运行时锁失败 |
| 权限要求 | 本地进程默认可用 |

#### start_reminder_session

| 项目 | 内容 |
|------|------|
| 调用名 | start_reminder_session |
| 请求参数 | `sessionId`：字符串 |
| 响应格式 | 单元成功或字符串错误 |
| 错误码 | 运行时锁失败 |
| 权限要求 | 本地进程默认可用 |

#### finish_activity_and_lock

| 项目 | 内容 |
|------|------|
| 调用名 | finish_activity_and_lock |
| 请求参数 | `sessionId`：字符串；`lockEnabled`：布尔 |
| 响应格式 | 单元成功或字符串错误 |
| 错误码 | 会话不匹配；锁屏失败；窗口恢复失败 |
| 权限要求 | 锁屏仅 Windows 可用 |

#### get_reminder_runtime

| 项目 | 内容 |
|------|------|
| 调用名 | get_reminder_runtime |
| 请求参数 | 无 |
| 响应格式 | JSON：`mandatoryModeActive`、`activeSessionId`、`nextTriggerAtMs`、`primaryCenterX`、`primaryCenterY` |
| 错误码 | 运行时锁失败 |
| 权限要求 | 本地进程默认可用 |

#### list_default_slogans

| 项目 | 内容 |
|------|------|
| 调用名 | list_default_slogans |
| 请求参数 | 无 |
| 响应格式 | 字符串数组 |
| 错误码 | 无 |
| 权限要求 | 本地进程默认可用 |

#### list_patches / list_plugins

| 项目 | 内容 |
|------|------|
| 调用名 | list_patches / list_plugins |
| 请求参数 | 无 |
| 响应格式 | 结构化数组（参见扩展模块约定） |
| 错误码 | 扩展加载失败时返回描述 |
| 权限要求 | 本地进程默认可用 |

### 3.3 接口通用处理规则

- 所有命令错误以 `String` 透出，前端负责展示。
- 涉及 `Mutex` 的状态访问失败统一映射为「加锁失败」类文案。
- Windows 平台分支必须在非 Windows 构建中具备空实现或可编译路径。

## 4. 数据库详细设计

### 4.1 数据表清单总览

第一版后端不使用关系型数据库或嵌入式 DB 表；提醒业务数据由前端 `localStorage` 维护。

### 4.2 单个数据表详细定义

不适用。

### 4.3 索引设计规范

不适用。

### 4.4 事务控制规则

不适用；运行时状态使用互斥锁保证原子更新。

## 5. 核心业务逻辑设计

### 5.1 核心业务流程步骤

1. 前端调度计算下次触发并调用 `update_next_trigger`。
2. 触发提醒时前端调用 `set_reminder_window_mode(true)` 获取主屏中心锚点用于 UI。
3. 用户开始活动：前端调用 `start_reminder_session`。
4. 倒计时结束：前端调用 `finish_activity_and_lock`，后端校验会话后恢复窗口并根据参数锁屏。

### 5.2 业务逻辑处理规则

- **强制模式焦点守护**：当强制模式开启时，后台线程周期性将主窗口拉回置顶与锁定尺寸直至强制模式关闭。
- **托盘 tooltip**：进入托盘图标区域时读取运行时 `next_trigger_label` 或时间戳 fallback。

### 5.3 异常处理流程

- 会话不匹配 → 拒绝结束活动以防错误解锁。
- 锁屏失败 → 错误返回前端提示。

## 6. Tauri命令定义

### 6.1 Tauri命令清单

见第 3.1 节表格。

### 6.2 单个命令详细定义（命令名称、入参、出参、权限、使用场景）

| 命令名称 | 入参 | 出参 | 权限 | 使用场景 |
|----------|------|------|------|----------|
| set_reminder_window_mode | active: bool | Result<(), String> | GUI / Win API | 进入或退出全屏强制视图 |
| update_next_trigger | triggerAtMs: Option<i64>, triggerLabel: Option<String> | Result<(), String> | 进程内 | 同步托盘展示 |
| finish_activity_and_lock | sessionId: String, lockEnabled: bool | Result<(), String> | 进程内 / OS | 会话结束与锁屏 |

### 6.3 命令安全校验规则

- 结束活动必须校验 `active_session_id` 与入参一致。
- 主窗口关闭：若强制模式激活则拒绝关闭；否则拦截并事件通知前端。

## 7. 通用规范设计

### 7.1 错误处理规范

- 平台不支持能力返回明确中文错误信息。
- Windows 注册表错误携带 Win32 错误码数字辅助定位。

### 7.2 日志埋点规范

第一版未统一接入结构化日志；关键失败路径通过返回字符串错误供前端呈现。迭代可引入 `log` crate。

### 7.3 性能优化规范

- 焦点守护线程睡眠间隔约数百毫秒，避免忙等。
- 显示器枚举仅在模式切换时触发。

### 7.4 安全防护规范

- 托盘事件仅映射固定字段名字符串，不接受任意载荷。
- 插件与补丁加载遵循扩展模块沙箱约束（参见扩展专门文档）。

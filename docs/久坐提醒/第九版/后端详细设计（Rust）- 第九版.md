# 后端详细设计（Rust）-第九版

> **【已锁定】** 锁定日期：2026-05-14。

## 1. 设计概述

### 1.1 设计目标

接入 **Tauri 官方 updater 与 process 插件**；修正 **get_app_info** 版本与标识；保持第八版既有命令与托盘逻辑不变。

### 1.2 设计约束

- 不修改 `extensions/` 下核心扩展实现。
- 新增依赖仅限 **官方插件 crate**，版本与 Tauri 2 兼容。

### 1.3 参考依据

《系统总体设计-第九版》《需求规格说明书-第九版》。

## 2. 后端目录结构定义

### 2.1 目录层级规范

第九版无新增命令文件；变更集中在 **`src-tauri/src/main.rs`**、**`src-tauri/src/commands/app.rs`**、**`src-tauri/Cargo.toml`**、**`src-tauri/tauri.conf.json`**、**`src-tauri/capabilities/default.json`**。

### 2.2 各目录职责定义

与第八版一致；插件初始化属于 **入口装配**。

### 2.3 文件命名规则

与项目规范一致。

## 3. 接口详细设计

### 3.1 接口清单总览

| 类型 | 名称 | 变更说明 |
|------|------|----------|
| Tauri 命令 | get_app_info | **version** 取自 **CARGO_PKG_VERSION**；**appId** 为固定常量与 **identifier** 对齐；**name** 取自 **CARGO_PKG_NAME** |
| 插件 | tauri-plugin-updater | 新增注册 |
| 插件 | tauri-plugin-process | 新增注册（供前端 relaunch） |

### 3.2 单个接口详细定义（表格化：请求路径、请求方法、请求参数、响应格式、错误码、权限要求）

#### 3.2.1 get_app_info

| 项目 | 说明 |
|------|------|
| 命令名 | get_app_info |
| 请求参数 | 无 |
| 响应格式 | JSON 对象 **AppInfo**：**name**（string）、**version**（semver string）、**appId**（string，与 bundle identifier 一致） |
| 错误码 | 无预期错误；若序列化失败为框架级错误 |
| 权限要求 | 包含在既有业务 capability 中（与 core invoke 一致） |

#### 3.2.2 插件 updater / process

| 项目 | 说明 |
|------|------|
| 暴露方式 | 前端 **@tauri-apps/plugin-updater** / **plugin-process** |
| 权限要求 | **updater:default**、**process:default** 写入 **default.json** |

### 3.3 接口通用处理规则

- 插件调用受 **capabilities** 约束；未授权时前端调用失败须在 UI 层提示「权限不足」类文案（开发期应避免出现）。

## 4. 数据库详细设计

### 4.1 数据表清单总览

无变更。

### 4.2 单个数据表详细定义

无变更。

### 4.3 索引设计规范

无变更。

### 4.4 事务控制规则

无变更。

## 5. 核心业务逻辑设计

### 5.1 核心业务流程步骤

1. 应用启动：`main` 注册 **process**、**updater**、**notification** 插件（顺序以实际编译通过为准，建议 **process → updater → notification** 或按官方示例）。
2. 前端挂载后调用 **get_app_info** 填充版本栏。
3. 用户触发更新：前端调用插件 **check**；若有结果则 **downloadAndInstall** 后 **relaunch**。

### 5.2 业务逻辑处理规则

- **get_app_info** 不得再出现硬编码旧版本号。
- **APP_BUNDLE_IDENTIFIER** 常量须与 **tauri.conf.json** 的 **identifier** 人工保持一致（代码审查 checklist）。

### 5.3 异常处理流程

- 插件层网络与签名校验异常透传至前端；后端业务命令不吞掉框架错误。

## 6. Tauri命令定义

### 6.1 Tauri命令清单

与第八版命令列表一致，无新增业务命令；**get_app_info** 行为修正。

### 6.2 单个命令详细定义

见 3.2.1。

### 6.3 命令安全校验规则

- 更新相关能力完全由 **官方插件 + pubkey** 保障；业务层不重复实现签名算法。

## 7. 通用规范设计

### 7.1 错误处理规范

- 保持 **String** 错误消息中文可读（既有命令）；插件错误由前端统一格式化。

### 7.2 日志埋点规范

第九版不强制新增结构化日志文件；可选在后续迭代增加「检查更新结果」本地诊断日志（P2）。

### 7.3 性能优化规范

- 不在 `get_app_info` 中做磁盘 IO；常量与编译期宏即可。

### 7.4 安全防护规范

- **createUpdaterArtifacts** 打开后 CI 必须审计 **签名密钥**访问审计与最小权限。

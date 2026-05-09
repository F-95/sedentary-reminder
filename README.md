# 久坐提醒（Sedentary Reminder）

基于 **Tauri 2**、**Rust**、**React**、**Vite**、**TypeScript** 与 **Ant Design** 的跨平台桌面应用，用于按间隔提醒起身活动，减轻久坐带来的健康风险。

## AI 生成声明

本仓库中的源代码、配置与文档主体由 **人工智能（AI）辅助生成或编写**，并在人工审阅与迭代下维护。使用、分发或二次开发前请自行评估适用性与合规要求；作者与贡献者不对因使用本软件造成的任何直接或间接损失承担责任。详见 [`LICENSE`](LICENSE)。

## 功能概览

| 能力 | 说明 |
|------|------|
| 间隔提醒 | 可配置提醒间隔（分钟），到达时间后触发提醒流程 |
| 全屏提醒页 | 沉浸式全屏界面，展示提醒文案与活动倒计时 |
| 自定义文案 | 支持多条提醒语；可选随机展示；可从后端加载默认标语（Slogan） |
| 免打扰时段 | 可总开关；支持多条时段（最多 20 条），每条可单独启用；支持**同日**与**跨午夜**（例如 22:00–次日 06:00，表现为开始分钟大于结束分钟）；与「下次提醒」计算联动，自动跳过时段内触发；链式推迟有安全上限，异常时会提示检查配置 |
| 配置持久化 | 提醒与免打扰配置使用 **v2** 存储键；可自动从早期 **v1** 本地形状迁移，避免升级后丢数据 |
| 系统通知 | 集成系统级通知（含临近触发等场景） |
| 开机自启 | 与系统登录项联动（具体行为依赖操作系统） |
| 活动结束后锁屏 | 可选在提醒流程结束后锁定屏幕（Windows 平台相关能力） |
| 强制专注模式 | 在特定提醒状态下限制窗口关闭，避免误跳过 |
| 扩展能力 | 预留**补丁（Patch）**与**插件（Plugin）**目录及加载机制；运行时编译产物不入库 |

## 界面预览

### 图1：主界面

![主界面：提醒设置与下次提醒时间等配置](docs/screenshots/main-interface.png)

### 图2：提醒界面

![提醒界面：全屏提醒文案与活动倒计时](docs/screenshots/reminder-interface.png)

## 技术栈

- 前端：React 18、Vite 5、Ant Design 5、TypeScript
- 桌面壳：Tauri 2
- 后端逻辑：Rust（命令层、提醒调度、平台能力等）

## 环境要求

- Node.js ≥ 18.17
- Rust（stable，建议 ≥ 1.75）
- npm ≥ 9
- 已安装 Tauri 2 所需系统依赖（Windows 需 Visual Studio Build Tools 等）

## 快速开始

```bash
npm install
npm run tauri dev
```

生产构建（需本机已配置 Tauri 打包环境）：

```bash
npm run tauri build
```

## Windows 安装包（GitHub Releases）

- **下载地址**：[Releases · F-95/sedentary-reminder](https://github.com/F-95/sedentary-reminder/releases)
- **发布前必做（版本更新记录）**：
  1. 在根目录 [`CHANGELOG.md`](CHANGELOG.md) 中把 `[Unreleased]` 的条目整理为新版 `## [x.y.z] - YYYY-MM-DD`，并保留 `[Unreleased]` 供后续累积；**必须与即将打的标签一致**，否则 [`release`](.github/workflows/release.yml) 工作流会因无法解析小节而失败。
  2. 将 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 三处 `version` 对齐为同一 `x.y.z`（与迭代设计文档约定一致）。
  3. 提交后创建并推送 Git 标签 `vx.y.z`，或用手动补跑工作流（见下）关联已有标签。
- **Release 正文来源**：CI 会从 `CHANGELOG.md` 中对应 `## [x.y.z]` 小节自动生成 GitHub Release 描述，并附带安装包格式简要说明；无需再手工粘贴整段发布说明。
- **构建方式**：
  1. **推送标签**：向仓库推送 `v*` 标签（如 `v0.1.5`）后，由 [`.github/workflows/release.yml`](.github/workflows/release.yml) 在 `windows-latest` 上执行 `npm run tauri build`，并创建或更新 **已发布（Published）** 的 Release（**非草稿**），上传 NSIS（`*-setup.exe`）与 MSI（`*.msi`）。
  2. **手动补跑**：在仓库 **Actions → release → Run workflow** 中填写已存在的 `tag_name`（如 `v0.1.5`），可在不重新打标签的情况下再次构建并上传资源。
- **说明**：工作流必须使用 `tauri-apps/tauri-action` 的 **`@v0` 或 `@action-x.y.z` 标签**（例如 `@action-v0.6.2`）；该仓库不存在 `@v1`，若写成 `@v1` 会导致工作流无法正确加载 Action，Release 不会出现。
- **权限要求**：若日志出现 **`Resource not accessible by integration`**（创建 Release 失败），请在仓库 **Settings → Actions → General → Workflow permissions** 中选择 **Read and write permissions** 并保存；否则 `GITHUB_TOKEN` 无法写入 Releases API。
- **SmartScreen**：未代码签名的安装包在 Windows 上可能出现 **SmartScreen（智能屏幕）** 提示，属正常现象；仅信任本仓库官方 Release 资产后再运行即可。

**安装提示（与 Release 描述一致）**：

- 推荐一般用户：下载 `*-setup.exe`，按向导安装（当前用户目录，无需管理员）。
- 企业/静默场景：可选用 `.msi`。
- 首次运行若出现 SmartScreen，请选择「仍要运行」或按企业策略放行。

**补登已有 GitHub Release 说明**：在仓库根目录执行 `npm run export:release-notes`，会在 [`release-notes/`](release-notes/) 下生成与 `CHANGELOG.md` 一致的 `v0.1.x.md`（含 CI 同款页脚）。将对应文件全文粘贴到 GitHub **Releases → 编辑该版本**，或使用已安装的 [GitHub CLI](https://cli.github.com/)：`gh release edit v0.1.0 --notes-file release-notes/v0.1.0.md`（对每个标签各执行一次）。之后新标签由工作流自动写入正文，无需再手工补登。

## 常用脚本

| 命令 | 作用 |
|------|------|
| `npm run dev` | 仅启动 Vite 前端开发服务 |
| `npm run build` | 前端 `tsc` + Vite 生产构建 |
| `npm run lint` / `npm run format` | 前端代码检查与格式化 |
| `npm run test` | 前端单元测试（Vitest） |
| `npm run pack:patch` / `npm run pack:plugin` | 补丁 / 插件打包辅助脚本 |
| `node scripts/changelog-for-release.mjs <x.y.z> [输出文件]` | 从 `CHANGELOG.md` 提取某版本正文（供本地核对或 `gh release edit --notes-file`） |
| `npm run export:release-notes` | 批量生成 `release-notes/v*.md`，用于补登历史 Release |

## 目录说明（节选）

- `src/`：React 应用（页面、工具函数、`plugins/loader.tsx` 插件宿主等）
- `src-tauri/`：Rust 与 Tauri 配置、命令与核心业务
- `CHANGELOG.md`：各版本更新摘要（发布与 CI Release 正文的唯一事实来源）
- `release-notes/`：由 `npm run export:release-notes` 生成的历史版本说明片段，用于补登 GitHub Release（与 CI 正文一致）
- `docs/久坐提醒/`：产品设计文档（含第三版等版本子目录）
- `patches/`、`plugins/`：扩展包目录；**仅元数据与 schema 宜入库**，`backend/`、`frontend/` 下编译产物见 `.gitignore`
- `public/`：不参与 Vite 打包的静态资源

## Git 提交建议（摘要）

- **宜提交**：应用源码、`package-lock.json`、`Cargo.lock`、Tauri/工具链配置、图标与文档、补丁/插件的 `manifest` 与 schema 等。
- **勿提交**：`node_modules/`、`dist/`、`src-tauri/target/`、`.vite/`、`.cursor/`、`.env*`、日志与 IDE 私有个性化配置、补丁/插件已编译的 `backend`/`frontend` 产物。

细节以项目根目录 [`.gitignore`](.gitignore) 为准。

## 许可证

本项目采用 **Apache License 2.0**，全文见 [`LICENSE`](LICENSE)。

## 第三方与资源说明

界面与逻辑可能依赖开源组件（如 Ant Design、Tauri 等），各组件自有许可证；若使用在线音频或图片 URL，请遵守对应站点与版权要求。

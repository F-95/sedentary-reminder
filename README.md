# 久坐提醒（Sedentary Reminder）

跨平台桌面应用：按间隔提醒起身活动，降低久坐健康风险。技术栈为 **Tauri 2**、**Rust**、**React**、**Vite**、**TypeScript**、**Ant Design**。

**当前版本**：`0.1.9` · 变更见 [`CHANGELOG.md`](CHANGELOG.md)

## 功能特性

**提醒与流程**

- 久坐：可配置间隔（分钟）、全屏提醒页、活动倒计时、自定义多条文案（可随机）、系统通知
- 补水：独立设置页与提醒配置
- 免打扰：总开关；最多 20 条时段；支持同日与跨午夜（如 22:00–次日 06:00）；与「下次提醒」联动跳过时段内触发；可折叠展示

**界面与数据**

- 设置枢纽：久坐 / 补水 / 免打扰分页面；子页左上图标返回
- 主题：浅色、深色、跟随系统；标题栏随主题同步
- 活动统计：主界面简报；详情按日 / 周 / 月 / 年；**仅本地存储**、无上传
- 主窗约 **520×760**，最小约 **400×660**（可缩放）

**系统与其他**

- 系统托盘：悬停显示状态与下次提醒时间
- 开机自启、活动结束后可选锁屏（Windows）、强制专注模式（特定状态下限制误关窗）
- 配置 **v2** 持久化，可从早期 **v1** 形状自动迁移
- 预留补丁（Patch）与插件（Plugin）扩展目录（运行时编译产物不入库）

## 界面预览

| 主界面 | 提醒页 |
|--------|--------|
| ![主界面](https://raw.githubusercontent.com/F-95/sedentary-reminder/refs/heads/main/docs/screenshots/main-interface.png) | ![提醒界面](https://raw.githubusercontent.com/F-95/sedentary-reminder/refs/heads/main/docs/screenshots/reminder-interface.png) |

## 下载与安装（Windows）

正式包见 **[GitHub Releases](https://github.com/F-95/sedentary-reminder/releases)**。

- 一般用户：`*-setup.exe`（当前用户安装，通常无需管理员）
- 企业 / 静默：可选 `.msi`
- 未签名包可能触发 **SmartScreen**；请仅信任官方 Release 资产后再运行

## 从源码运行

**环境**：Node.js ≥ 18.17、npm ≥ 9、Rust（stable，建议 ≥ 1.75）、本机已满足 [Tauri 2 系统依赖](https://v2.tauri.app/start/prerequisites/)（Windows 需 Visual Studio Build Tools 等）。

```bash
npm install
npm run tauri dev
```

生产构建：

```bash
npm run tauri build
```

## 技术栈

- 前端：React 18、Vite 5、Ant Design 5、Ant Design Plots（活动统计图表）、TypeScript
- 桌面：Tauri 2（托盘、通知等）
- 业务与平台能力：Rust

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 仅前端开发服务（Vite） |
| `npm run build` | 前端生产构建（`tsc` + Vite） |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run test` | 单元测试（Vitest） |
| `npm run pack:patch` / `npm run pack:plugin` | 补丁 / 插件打包辅助 |
| `npm run export:release-notes` | 从 `CHANGELOG` 批量生成 `release-notes/v*.md`（补登历史 Release 说明时用） |
| `node scripts/changelog-for-release.mjs <x.y.z>` | 提取单版本正文（本地核对或 `gh release edit --notes-file`） |

## 仓库结构（节选）

| 路径 | 说明 |
|------|------|
| `src/` | React 应用（含 `plugins/loader.tsx` 插件宿主） |
| `src-tauri/` | Rust、Tauri 配置与命令 |
| `docs/久坐提醒/` | 产品设计文档（多版本归档；实现与**第六版**对齐） |
| `docs/global/` | 全局文档（如推广文案等） |
| `CHANGELOG.md` | 版本更新与 Release 正文依据 |
| `patches/`、`plugins/` | 扩展包；编译产物见 `.gitignore`，勿提交 |
| `public/` | 不经 Vite 打包的静态资源 |

## 发布与 CI（维护者）

发版前：`CHANGELOG.md` 写入 `## [x.y.z]` 且与即将推送的标签一致；`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 三处 **version** 对齐。推送 `vx.y.z` 后由 [`.github/workflows/release.yml`](.github/workflows/release.yml) 构建并发布 Windows 安装包。

**Tauri 自动更新签名（必配）**：本仓库在 `tauri.conf.json` 中启用了 **`bundle.createUpdaterArtifacts`** 并配置了 **updater 公钥**，因此 **GitHub Actions 构建阶段必须能读取私钥**，否则会报错：`A public key has been found, but no private key`。请在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中新建 **Repository secrets**：

| Secret 名称 | 是否必填 | 说明 |
|-------------|----------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | **必填** | minisign 私钥的**完整文件内容**（与 `tauri.conf.json` 里 `plugins.updater.pubkey` 成对；通常即本机 `src-tauri/keys/updater.key` 全文，勿提交该文件到 Git）。 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 可选 | 生成密钥时若设置了密码则填写，否则可省略。 |

本地发版构建同样需在 shell 中导出上述环境变量（Tauri **不会**从 `.env` 读取签名变量）。详见 [Tauri 文档：Signing updates](https://v2.tauri.app/plugin/updater/#signing-updates)。

若创建 Release 失败，检查仓库 **Actions** 是否具备 **Read and write** 权限；工作流内 `tauri-action` 须使用官方文档推荐的标签（勿误用不存在的 `@v1`）。历史版本若需补登说明，可用 `npm run export:release-notes` 或 `gh release edit … --notes-file`。

## AI 生成声明

本仓库代码、配置与文档主体由 **AI 辅助生成**，经人工审阅维护。使用请自行评估适用性与合规；作者与贡献者不对使用本软件造成的损失承担责任。许可见 [`LICENSE`](LICENSE)。

## 许可证

**Apache License 2.0**，见 [`LICENSE`](LICENSE)。依赖组件（如 Ant Design、Tauri）各有其许可证。

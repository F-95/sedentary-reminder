---
name: project-init
description: 当需要从零初始化符合工业级规范的Tauri+Rust+React+Vite桌面应用项目时触发，严格遵循《项目结构强制规范》，一键生成内置补丁热升级、插件化扩展双核心能力的标准化项目，支持可选集成Ant Design UI框架，生成的项目可直接安装依赖启动开发服务，无需手动调整结构与配置。
---

# project-init

## 核心定位

本技能用于生成标准化、可直接运行的Tauri桌面应用项目，固定技术栈为Tauri 2.0+、Rust、React 18+、Vite 5+、TypeScript，**严格遵循《项目结构强制规范》（以下简称「规范文档」）定义的目录结构、命名规则与约束条款，本技能与规范文档冲突时，以规范文档为唯一权威标准**。内置补丁热升级、插件化扩展双核心能力，支持可选集成Ant Design UI框架，零冗余配置，生成后可直接安装依赖启动。

## 触发场景

1. 项目从零启动，需要初始化完整的、符合规范文档的Tauri全栈项目结构

2. 需要创建带补丁热更新、插件化扩展能力的桌面应用基础框架

3. 重构现有Tauri项目，统一目录结构与跨角色开发规范

4. 快速生成符合扩展规范的项目模板，用于后续业务功能开发

5. 新建符合三端兼容（Windows/macOS/Linux）标准的Tauri项目

6. 需要快速集成Ant Design UI框架，开箱即用启动业务开发的Tauri项目初始化

## 执行步骤（严格按顺序执行，无用户确认不得跳过）

### 1. 前置校验与确认

#### 校验顺序与规则（严格按顺序执行，异常直接终止）

1. **环境权限校验**：校验当前Trae环境的文件系统写入、命令行工具调用权限，权限不足立即终止执行，输出「权限不足：无法写入文件/调用命令行，请提升权限后重试」

2. **目录状态校验**：检查当前工作目录是否为空，若非空必须先向用户确认「是否在当前目录直接初始化，还是新建子目录初始化」，未得到用户明确确认前，禁止执行后续操作；若用户确认覆盖已有文件，必须先备份原有文件至`[目录名]_backup_[时间戳]`目录，再执行覆盖

3. **应用基础信息确认**：向用户确认应用名称、应用ID，默认应用名为`tauri-ext-app`，默认应用ID为`com.tauri.ext.app`，用户可自定义修改

4. **可选功能确认**：向用户确认是否需要集成Ant Design UI框架（默认不集成），若选择集成，将自动完成依赖安装、构建配置、全局样式引入、主题配置与示例组件生成

### 2. 全量目录结构创建

- 严格遵循规范文档创建完整目录，**完整目录结构、命名规则、禁止修改条款以规范文档为准**，禁止私自调整目录层级与命名

- 所有目录必须附带对应的入口文件，禁止生成空目录

- 核心目录树如下（完整规范详见引用的规范文档）：

```Plain Text

/（当前项目的根目录）
├── docs # [文档] 开发文档
│   ├── global/ # 全局文档
│   ├── function/ # 功能文档
├── src/ # [前端] React 源代码（Vite 构建）
│   ├── assets/ # 静态资源（图片、字体等，经过 Vite 构建）
│   ├── components/ # 通用 React 组件（可复用于多页面 / 插件）
│   ├── pages/ # 主应用页面组件
│   ├── plugins/ # [扩展] 插件前端加载器与已安装插件的前端部分
│   │   └── loader.tsx # 插件前端统一加载入口（禁止修改，与规范文档一致）
│   ├── types/ # 全局TypeScript类型声明
│   ├── utils/ # 前端工具函数（含 Tauri 命令封装）
│   ├── App.tsx # React 根组件（集成插件渲染区域）
│   ├── main.tsx # React 入口文件
│   └── vite-env.d.ts # Vite 类型声明
├── src-tauri/ # [后端] Rust + Tauri 核心代码
│   ├── src/ # Rust 源代码
│   │   ├── commands/ # Tauri 命令层（前端可调用的 API）
│   │   ├── core/ # 核心业务逻辑层
│   │   ├── extensions/ # [扩展] 核心扩展系统（禁止随意修改，与规范文档一致）
│   │   ├── plugins/ # [扩展] 已安装插件的后端代码（动态链接）
│   │   └── main.rs # Tauri 入口文件（初始化扩展系统）
│   ├── tauri.conf.json # Tauri 配置文件
│   ├── build.rs # Rust 构建脚本
│   └── Cargo.toml # Rust 依赖配置
├── patches/ # [扩展] 补丁包存储目录（运行时动态读取）
├── plugins/ # [扩展] 插件包存储目录（运行时动态读取）
├── scripts/ # [工程化] 补丁/插件打包、版本管理跨平台脚本
├── public/ # 前端静态资源（不经过 Vite 构建，直接复制）
├── .gitignore # Git 忽略规则
├── package.json # 前端依赖配置
├── vite.config.ts # Vite 构建配置
└── tsconfig.json # TypeScript 配置
```

### 3. 前端工程化与模板文件生成

- 生成`package.json`：固定稳定兼容版本依赖，配置开发、构建、类型检查、打包全量脚本，核心依赖版本如下：

```JSON

{
  "dependencies": {
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "@tauri-apps/api": "2.0.0"
  },
  "devDependencies": {
    "vite": "5.0.10",
    "typescript": "5.2.2",
    "@tauri-apps/cli": "2.0.0",
    "@vitejs/plugin-react": "4.2.1",
    "@types/react": "18.2.43",
    "@types/react-dom": "18.2.17",
    "eslint": "8.55.0",
    "eslint-plugin-react-hooks": "4.6.0",
    "eslint-plugin-react-refresh": "0.4.5",
    "prettier": "3.1.1"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "format": "prettier --write src/"
  }
}
```

- 生成`vite.config.ts`：配置Tauri Vite插件、路径别名、构建输出规则、插件前端代码动态构建配置、三端兼容适配

- 生成`tsconfig.json`：启用TypeScript严格模式，零any类型约束，配置路径别名、全局类型声明，适配Tauri+React技术栈

- 生成React核心入口文件：`src/main.tsx`、`src/App.tsx`，内置插件加载器的集成逻辑、全局状态管理入口

- 生成扩展能力核心模板：`src/plugins/loader.tsx`（插件前端统一加载器，与规范文档一致，禁止修改）、`src/utils/tauri.ts`（Tauri命令统一封装，含补丁/插件相关API）、`src/types/global.d.ts`（全局类型声明，含补丁、插件、应用全局类型定义）

- 生成基础示例代码：通用组件示例、首页页面模板、类型声明示例，确保项目可直接启动渲染

- 【可选】若用户确认集成Ant Design，自动执行以下配置：

    1. 在`package.json`中新增固定版本依赖：`antd@5.12.0`、`@ant-design/icons@5.2.6`，开发依赖新增`unplugin-auto-import@0.17.3`、`unplugin-vue-components@0.26.0`

    2. 修改`vite.config.ts`，配置Ant Design按需自动加载，不改动原有构建规则

    3. 修改`src/main.tsx`，引入`antd/dist/reset.css`全局样式，不改动原有入口逻辑

    4. 修改`src/App.tsx`，通过`ConfigProvider`包裹根组件，配置全局主题，内置插件渲染区域

    5. 在`src/components/`下生成`PrimaryButton.tsx`示例组件（基于Ant Design封装的通用业务组件，符合规范文档命名规则）

### 4. Tauri后端Rust核心代码生成

- 生成`src-tauri/Cargo.toml`：固定Tauri 2.0+稳定版本依赖，配置补丁动态库加载、插件沙箱相关crate，配置三端兼容的编译选项、优化参数，核心依赖版本如下：

```TOML

[package]
name = "tauri-ext-app"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2.0.0", features = ["api-all"] }
serde = { version = "1.0.193", features = ["derive"] }
serde_json = "1.0.108"
thiserror = "1.0.50"
tokio = { version = "1.35.0", features = ["full"] }
libloading = "0.8.1"

[build-dependencies]
tauri-build = { version = "2.0.0", features = [] }
```

- 生成`src-tauri/tauri.conf.json`：配置应用ID、窗口规则、权限配置（含补丁、插件目录的文件系统访问权限、网络访问权限）、构建配置、安全策略，与规范文档要求一致

- 生成`src-tauri/build.rs`：Tauri构建脚本，适配扩展系统的编译规则、三端动态库加载配置

- 生成Rust入口文件`src-tauri/src/main.rs`：内置扩展系统（补丁、插件）的初始化逻辑、Tauri应用启动逻辑、全局状态管理、命令注册

- 生成**完整可运行的扩展系统代码**，与规范文档目录结构完全一致：

    - 补丁升级系统：`src-tauri/src/extensions/patch/`下完整代码，包含补丁包校验、加载、执行、回滚、版本管理全量逻辑，配套`rollback.rs`、`manifest.rs`

    - 插件安装系统：`src-tauri/src/extensions/plugin/`下完整代码，包含插件注册、沙箱加载、权限校验、生命周期管理、API调用限制全量逻辑，配套`manifest.rs`、`permission.rs`

- 生成命令层代码：`src-tauri/src/commands/mod.rs`、`patch.rs`、`plugin.rs`、`app.rs`，包含前端可调用的全量Tauri命令，完整的入参校验、错误处理

- 生成核心层代码：`src-tauri/src/core/mod.rs`、`app_state.rs`、`config.rs`、`error.rs`，包含应用全局状态、配置管理、统一错误类型、跨模块通用逻辑

- 所有Rust模块必须配套完整的`mod.rs`导出声明，符合Rust官方规范，禁止生成无效代码

### 5. 扩展能力配套文件生成

- 生成`patches/manifest.schema.json`：补丁包元信息JSON Schema，强制规范补丁包格式、版本规则、三端兼容配置、执行顺序，与规范文档要求一致

- 生成`plugins/manifest.schema.json`：插件包元信息JSON Schema，强制规范插件ID、版本、权限声明、依赖配置、三端兼容规则，与规范文档要求一致

- 生成`scripts/`目录下的补丁打包脚本、插件打包脚本、版本管理脚本，配套跨平台构建配置

- 明确补丁/插件后端动态库跨平台规范：Windows平台为`.dll`、macOS平台为`.dylib`、Linux平台为`.so`

### 6. 工程化与规范配置生成

- 生成`.gitignore`：完整适配Tauri+Rust+React项目，强制忽略`patches/`、`plugins/`下的运行时文件、`src-tauri/target/`构建产物、临时文件、环境变量文件，与规范文档要求一致

- 生成前端代码规范配置：`.eslintrc.js`、`.prettierrc`，适配React+TypeScript+Tauri技术栈，若集成Ant Design则补充对应校验规则

- 生成Rust代码规范配置：`rustfmt.toml`、`clippy.toml`，符合Rust官方最佳实践，强制代码风格统一

- 生成`README.md`：完整的项目说明文档，包含环境要求、启动命令、目录结构说明、补丁开发规范、插件开发规范、Ant Design使用指引（若集成）、常见问题解决

### 7. 后置校验与收尾

- 目录完整性校验：对比规范文档与预设目录树，检查所有核心目录与文件是否创建完成，无遗漏、无路径错误

- 配置文件语法校验：校验所有JSON/TOML/TypeScript/Rust文件语法合法性，无语法错误

- 依赖兼容性校验：检查前后端依赖版本兼容性，无版本冲突，无通配符版本号

- 规范符合性校验：检查所有内容是否符合规范文档的约束条款，无违规内容

- 可选功能校验：若用户选择集成Ant Design，校验所有配置是否完整、可正常运行

- 全量校验通过后，向用户输出完整的初始化完成报告

## 强制输出规范

1. **规范优先级约束**：所有目录结构、命名规则、扩展系统约束必须优先遵循规范文档，本技能与规范文档冲突时，以规范文档为准

2. **代码规范约束**

    - 前端代码：必须符合TypeScript严格模式，零any类型，完整的类型声明，清晰的中文注释，符合ESLint+Prettier规范，无语法错误

    - Rust代码：必须符合Rust官方API Guidelines，完整的文档注释，安全优先，非必要不使用unsafe代码，可通过rustfmt与Clippy全量检查零告警

    - 配置文件：必须使用固定稳定版本号，禁止使用通配符版本，避免兼容性问题，所有配置必须三端兼容

3. **路径与结构约束**

    - 所有文件必须明确完整的相对路径，可直接通过Trae文件系统工具写入对应位置，无需用户手动调整目录

    - 必须严格遵循规范文档定义的目录结构与命名规则，禁止私自修改

4. **扩展能力约束**

    - 补丁、插件核心系统代码必须完整可运行，包含完整的类型定义、错误处理、安全校验、权限控制逻辑，禁止生成空模板

    - 必须为补丁升级、插件扩展提供完整的开发规范、示例代码、类型声明，支持用户直接基于框架开发扩展功能

5. **Ant Design集成约束（可选）**

    - 必须作为可选功能，禁止强制绑定集成

    - 全局主题配置必须统一在`src/App.tsx`中通过`ConfigProvider`实现，禁止在单组件内零散修改主题token

    - 基于Ant Design封装的通用组件必须放在`src/components/`目录，符合规范文档的命名规则，禁止直接覆盖Ant Design原生组件名

6. **兼容性约束**

    - 所有生成的内容必须适配Windows、macOS、Linux三端，无平台专属的硬编码配置

    - 必须适配Trae的MCP工具调用、文件系统操作、命令行执行能力，无冲突配置

## 绝对禁忌规则

1. 禁止生成空目录，所有核心目录必须附带对应的[mod.rs](mod.rs)、index.ts等入口文件

2. 禁止违背规范文档定义的目录结构、命名规则与约束条款

3. 禁止修改固定的技术栈主版本，必须使用Tauri 2.0+、React 18+、Vite 5+稳定兼容版本

4. 禁止遗漏补丁升级、插件扩展的核心逻辑代码，不得只生成空目录无实现

5. 禁止在.gitignore中遗漏patches/、plugins/下的运行时文件、src-tauri/target/构建产物

6. 禁止生成无法直接编译运行的代码，所有配置必须无语法错误、无依赖版本冲突

7. 禁止在未得到用户明确确认的情况下，覆盖现有目录的已有文件

8. 禁止生成脱离业务场景的过度设计代码，所有代码必须可直接落地使用

9. 禁止修改规范文档中明确禁止修改的核心扩展系统代码

10. 禁止强制绑定Ant Design UI框架，必须作为用户可选配置项

11. 禁止在未完成前置校验全流程的情况下，执行后续初始化步骤

## 执行完成后必须输出

1. 项目初始化完成的明确确认信息

2. 项目完整的目录结构树

3. 环境要求说明（明确最低版本要求）：

    - Node.js ≥ 18.17.0（LTS版本）

    - Rust ≥ 1.75.0（stable通道）

    - Tauri CLI ≥ 2.0.0

    - 包管理器：npm ≥ 9.0.0 / yarn ≥ 1.22.0 / pnpm ≥ 8.0.0

4. 后续操作命令：依赖安装命令、开发服务启动命令、生产构建命令

5. 补丁升级、插件扩展的开发入门指南与核心规范

6. 规范文档引用说明与查阅指引

7. 【可选】若集成Ant Design，输出对应的集成说明、主题配置指引与使用示例

8. 完整的常见问题排查指引，包含通用启动问题、补丁/插件异常、Ant Design集成问题

## 执行示例

### 用户输入

执行项目初始化

### 执行输出

1. 前置校验与确认提示

```Plain Text

请确认以下初始化信息，未明确确认前将终止执行：
1. 当前目录非空，是否在当前目录直接初始化？（Y/N）
2. 应用名称默认：tauri-ext-app，是否修改？（直接回车使用默认/输入自定义名称）
3. 应用ID默认：com.tauri.ext.app，是否修改？（直接回车使用默认/输入自定义ID）
4. 是否需要集成Ant Design UI框架？（Y/N，默认N）
```

1. 用户确认示例

```Plain Text

Y
默认
com.my.desktop.app
Y
```

1. 初始化完成报告

```Plain Text

✅ 项目初始化完成！
📁 项目路径：/当前工作目录/tauri-ext-app
📋 核心配置信息
- 应用名称：tauri-ext-app
- 应用ID：com.my.desktop.app
- 已集成：Ant Design 5.12.0
- 核心能力：补丁热升级、插件化扩展系统

📦 项目完整目录结构
/tauri-ext-app
├── docs/
├── src/
│   ├── assets/
│   ├── components/
│   │   └── PrimaryButton.tsx
│   ├── pages/
│   ├── plugins/
│   │   └── loader.tsx
│   ├── types/
│   │   └── global.d.ts
│   ├── utils/
│   │   └── tauri.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   ├── core/
│   │   ├── extensions/
│   │   ├── plugins/
│   │   └── main.rs
│   ├── tauri.conf.json
│   ├── build.rs
│   └── Cargo.toml
├── patches/
├── plugins/
├── scripts/
├── public/
├── .gitignore
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md

🔧 环境最低要求
- Node.js ≥ 18.17.0
- Rust ≥ 1.75.0
- Tauri CLI ≥ 2.0.0

🚀 快速启动命令
cd tauri-ext-app
npm install
npm run tauri dev

📖 开发入门指南
1. 补丁开发
   - 在patches/[version-tag]/目录下编写manifest.json与前后端代码
   - 执行npm run pack:patch 打包补丁包
   - 补丁支持热加载与一键回滚，完整规范见docs/补丁开发规范.md

2. 插件开发
   - 在plugins/[plugin-id]/目录下编写manifest.json与前后端代码
   - 执行npm run pack:plugin 打包插件包
   - 插件内置权限沙箱，仅可调用manifest.json中声明的权限，完整规范见docs/插件开发规范.md

3. Ant Design使用
   - 全局主题配置在src/App.tsx的ConfigProvider中统一修改
   - 通用业务组件请封装在src/components/目录下
   - 示例组件已生成：src/components/PrimaryButton.tsx

⚠️ 常见问题排查
1. 启动报错「tauri dev failed」：检查Rust版本是否≥1.75.0，执行rustup update stable更新
2. 补丁加载失败：检查patches/[version-tag]/manifest.json是否符合schema规范，动态库是否匹配当前平台
3. 插件权限报错：检查插件manifest.json中声明的权限是否已在tauri.conf.json中配置
4. Ant Design样式异常：检查src/main.tsx中是否已引入antd/dist/reset.css全局样式
```
> （注：文档部分内容可能由 AI 生成）
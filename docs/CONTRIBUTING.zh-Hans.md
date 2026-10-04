# 贡献指南

[English](../CONTRIBUTING.md) · **简体中文**

我们热烈欢迎对 SJMCL 作出任何形式的贡献，包括提交议题、开发新功能、完善文档等。🥰

以下是参与 SJMCL 贡献的一组指南。请在提交议题或拉取请求前花几分钟阅读这些指南。

## 行为准则

我们采用了一份所有项目参与者都应遵守的[行为准则](CODE_OF_CONDUCT.zh-Hans.md)。请花一点时间阅读其全文，了解哪些行为可以接受，哪些行为不会被容忍。

## 缺陷

我们使用 [GitHub Issues](https://github.com/UNIkeEN/SJMCL/issues) 跟踪缺陷。请使用 `Bug report` 议题模板，提供可帮助我们确认缺陷的信息，例如复现步骤、预期行为、运行环境以及其他补充信息。

报告缺陷前，请确保已经搜索过现有议题。

## 提议变更

如果你希望提议或添加新功能，我们建议先创建议题（使用 `Feature Request` 模板）并与核心团队讨论。这个过程有助于我们判断该功能是否适合 SJMCL，并在开始开发前进一步完善想法。

<!-- ### 你的第一个拉取请求（待完善）-->

## 提交拉取请求

核心团队会定期查看拉取请求。我们将审查你的拉取请求，然后合并、要求修改，或在说明原因后将其关闭。

**提交拉取请求前**，请确保完成以下事项：

- Fork 本仓库并创建你自己的分支。
- 在本地测试改动，确保其符合预期。
- 必要时更新文档。
- 确保代码风格和提交信息符合项目规范。（提交信息不符合规范的 PR 可能会被关闭，或在合并时压缩为单个提交。）
- 确保代码通过 lint 检查（`pnpm lint-staged`）。提示：执行 `git commit` 时会自动运行 lint 检查。
- 最后，请确保所有 GitHub CI 检查均通过。

## 开发流程

### 准备工作

本项目使用 **[Tauri v2](https://v2.tauri.app/)**。请确保已经安装 [Node.js >=22](https://nodejs.org/) 和 [Rust >=1.98.1](https://www.rust-lang.org/learn/get-started)。

我们推荐使用 `pnpm` 作为前端包管理器。克隆仓库后，使用以下命令安装依赖：

```bash
pnpm install
```

### 配置环境变量

将 `.env.template` 文件复制为 `.env`，并根据模板中的注释填写所需的环境变量。

这些值将作为编译时常量嵌入 Rust 后端。

### 本地运行

以开发模式运行项目。

```bash
pnpm tauri dev
```

### 检查代码风格

我们使用 `ESLint` 和 `Prettier` 检查前端代码，并使用 `rustfmt` 检查后端代码，以确保代码风格一致。

```bash
pnpm lint-staged
```

也可以使用以下命令手动检查并修复格式问题：

```bash
# 前端部分
pnpm eslint "src/**/*.{js,jsx,ts,tsx}" --no-fix    # 检查
pnpm eslint "src/**/*.{js,jsx,ts,tsx}" --fix       # 修复

# 后端部分（Linux、macOS 或 Windows 上的 Git Bash）
rustfmt --check src-tauri/src/**/*.rs              # 检查
rustfmt src-tauri/src/**/*.rs                      # 修复

# 后端部分（Windows PowerShell）
cd src-tauri
cargo fmt -- --check src/**/*.rs                   # 检查
cargo fmt -- src/**/*.rs                           # 修复
```

如果使用 VS Code 开发本项目，我们建议在工作区设置中将 `rust-analyzer.check.command` 设为 `clippy`，以进行更严格的代码检查。

### 构建

将项目构建为可执行文件。

```bash
pnpm tauri build
```

如需跨平台编译、打包为特定格式或了解更多信息，请参阅 Tauri 官方的[分发指南](https://tauri.app/distribute/)。

## 成为协作者

如果你是一名活跃贡献者，并希望与 SJMCL 团队更紧密地参与开源协作流程 💪，请通过 [launcher@sjmc.club](mailto:launcher@sjmc.club) 联系我们。

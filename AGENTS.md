# SJMC Launcher 项目开发指南

> 本文件为 AI 编程助手提供项目上下文和开发规范。

## 项目信息

- 跨平台 Minecraft 启动器，简称 SJMCL
- 使用 [Tauri](https://tauri.app/) 框架开发，前端 React + Next.js + [Chakra UI v2](https://v2.chakra-ui.com/)，后端 Rust
- 支持多游戏目录与实例、多账户、MCP 集成、扩展系统、国际化

### 项目结构

> 以下为精简后的核心结构示意，仅列出高频开发目录与关键入口，不展开所有文件。

```text
SJMCL/
├── src/                      # 前端源码（React）
│   ├── pages/                # 前端页面路由（Next JS Page Router）
│   │   ├── ...               
│   │   ├── extension/        # 扩展页面入口
│   │   └── standalone/       # 独立窗口页面（如游戏日志、错误页）
│   ├── components/           # 通用与业务组件
│   │   ├── common/           # 基础组件
│   │   ├── modals/           # 各类弹窗
│   │   ├── extension/        # 扩展系统相关组件
│   │   └── special/          # 全局事件、共享 Provider 等特殊组件
│   ├── layouts/              # 页面布局封装（一类特殊组件）
│   ├── contexts/             # React Context 与对应 Provider
│   │   └── extension/        # 扩展宿主上下文
│   ├── hooks/                # 自定义 Hooks
│   ├── services/             # 前端服务层，与后端各功能域交互
│   ├── models/               # 数据模型
│   ├── locales/              # i18n 国际化文本
│   ├── styles/               # Chakra 主题、CSS 样式
│   ├── enums/                # 枚举定义
│   └── utils/                # 前端工具函数
├── src-tauri/                # 后端源码（Rust）
│   ├── src/                  
│   │   ├── account/          # 账户管理
│   │   │   ├── mod.rs        # 各功能模块下遵循类似结构，分为以下若干模块（文件或文件夹形式）
│   │   │   ├── commands.rs   # Tauri 命令（包含少量功能逻辑）
│   │   │   ├── constants.rs  # 常量
│   │   │   ├── models        # 数据模型
│   │   │   ├── helpers       # 内部实现（处理复杂功能逻辑、私有数据模型）
│   │   │   └── migrations.rs # 格式迁移（可选，兼容层，非迁移脚本）
│   │   ├── discover/         # Minecraft 新闻与社区内容发现
│   │   ├── extension/        # 扩展系统
│   │   ├── instance/         # 游戏实例、实例资源管理
│   │   ├── intelligence/     # 智能能力与 MCP 集成
│   │   ├── launch/           # 启动流程
│   │   ├── launcher_config/  # 启动器配置
│   │   ├── resource/         # 游戏资源搜索与下载
│   │   ├── tasks/            # 后台任务系统（现主要用于下载）
│   │   └── utils/            # 后端工具函数
│   ├── assets/               # 后端静态资源
│   ├── crates/               # 计划分拆后端功能到对应crate，此为装载目录
│   │   ├── sjmcl-types/      # 后端通用Types以及Traits
│   │   └── sjmcl-macros/     # 后端所使用的过程宏包
│   └── infoplist/            # macOS InfoPlist 资源
├── public/                   # 前端静态资源
├── docs/                     # 文档
└── cli/                      # 配套 CLI（通过 MCP 集成操作应用本体）
```

- 前端代码整体按页面、组件、状态上下文与服务层分层。
- 后端代码整体先按功能域划分模块；每个功能域内使用类似结构。
- 前端 `services/` 封装对 Tauri 后端的 `invoke` 调用与 `emit` 监听，和后端各功能域的 `commands.rs` 一一对应。
- 前端各个组件调用 `services/` 中的某个函数时，需要封装其对应的 handle 函数使用，参考已有代码或 [讨论](https://github.com/UNIkeEN/SJMCL/pull/61#issuecomment-2613819641)

---

## 通用编码规范

- 前端导入优先使用已配置别名和绝对路径、不使用相对路径；后端导入使用绝对路径（`use crate::...`），不使用相对路径（`use super::...`）。
- 新增或修改 `src/locales` 下的国际化文本时，同时更新所有语言文件。注意语言文件的一级 key 使用字母序排序。

## 扩展开发规范

SJMCL 的扩展系统允许开发者在不修改核心代码的情况下添加各类有趣功能

- 我们推荐使用 [脚手架](https://www.npmjs.com/package/create-sjmcl-extension) 初始化项目。
- 具体的扩展接口可以参考 [API 文档](https://mc.sjtu.cn/sjmcl/dev/extension/api.html) 或 `src/contexts/extension/host.tsx`。
- 开发完成后，可以在 [社区精选列表](https://github.com/SJMC-Dev/awesome-SJMCL-extensions) 提交扩展。

---

## 编码行为准则

旨在减少 LLM 编码中常见错误的行为准则，可与项目特定指令合并使用。

**权衡：** 本准则倾向于"谨慎优于速度"。对于简单任务，请自行判断。

### 1. 先思考再编码

**"不要默认假设。不要隐藏困惑。呈现权衡。"**

实现之前：

- 明确陈述假设；如果不确定或不明白，就提问。
- 当存在多种理解时，逐一列出而非默默选择。
- 如果存在更简单的方案，直接说明并在必要时提出异议。

### 2. 简洁优先

**"用最少的代码解决问题。不做臆测性编码。"**

- 不实现超出需求的特性。
- 不为仅使用一次的代码做抽象。
- 不添加未经要求的"灵活性"或"可配置性"。
- 不处理在当前系统边界内不会发生的错误场景。

### 3. 精准改动

**"只改必须改的。只清理自己制造的遗留。"**

编辑现有代码时：

- 不要"改善"相邻的代码、注释或格式。
- 不要重构没有问题的代码。
- 与现有风格保持一致。
- 如果发现无关的废弃代码，提出来而不是直接删除。

当你的改动产生了孤立的代码时：

- 移除因你的改动而变得未使用的 import/变量/函数。
- 不要移除之前就存在的废弃代码，除非被明确要求。

检验标准："每一行改动都应该能追溯到用户的请求。"

### 4. 目标驱动执行

**"定义成功标准。循环验证直到通过。"**

将任务转化为可验证的目标：

- "添加校验" → 为无效输入编写测试，然后使其通过
- "修复 Bug" → 编写复现测试，然后使其通过
- "重构 X" → 确保重构前后测试都通过

对于多步骤任务，简要列出计划：

```
1. [步骤] → 验证：[检查方式]
2. [步骤] → 验证：[检查方式]
3. [步骤] → 验证：[检查方式]
```

---
name: sjmcl-commit-msg
description: Generate a single-line commit message for SJMCL by reading the staged changes and recent commit style. Use this skill when the user asks for a commit message, says commit msg, or wants one-line text that covers all staged changes.
---

# SJMCL Commit Message 生成规范

## 目标

一、基于当前 git 暂存区生成一行 commit message，覆盖本次提交的全部改动。  
二、优先贴近 SJMCL 现有提交风格，而不是直接套模板。

## 核心原则

commit message 不是逐文件罗列，而是对这次提交意图的压缩表达。  
先读暂存区，再归纳，再输出 **一行英文**。

## 触发场景

当用户提及以下情况时使用本 skill：

- 要写 commit message、提交信息
- 说「msg」且语境是 git 提交
- 需要根据当前工作区改动、暂存区生成一句提交说明

## 基本规则

### 一、默认只看暂存区

默认只根据 staged changes 生成 message，因为真正会被提交的是暂存区内容。  
只有用户明确要求包含未暂存内容时，才额外查看 `git diff`。

### 二、必须先看最近提交风格

生成 message 前，除了看暂存区，还要看最近提交历史，避免写出不符合仓库习惯的格式。

### 三、默认只输出最终一行

除非用户明确要求解释，否则最终回复只给一行 commit message，不附带分析。

## 执行步骤

### 1. 读取 git 状态、暂存区和最近提交

建议首先执行命令：

```bash
git status --short
git diff --cached --stat
git diff --cached
git log --oneline -10
```

不要只凭文件名猜测内容。

### 2. 判断是否能生成

如果暂存区为空：

- 不要编造 message。
- 明确说明当前没有 staged changes，无法基于提交区生成准确的一行 commit message。

### 3. 归纳这次提交的主要语义

根据 `git diff --cached` 结果：

1. 判断本次提交的主要目的，是 `feat`、`fix`、`docs`、`refactor`、`chore` 等哪一类。
2. 判断 **主要影响范围**，是否适合加 `scope`。
3. 如果包含多个小改动，用一个更高层级的概括覆盖全部，不要把每个点都塞进标题。

### 4. 对齐仓库风格和写法要求

根据 `git log --oneline -10` 结果可见 SJMCL 仓库近期写法。

优先模仿近期写法和后文的写法要求，如：

- `fix(frontend): ...`
- `fix(instance): ...`
- `feat(ci): ...`
- `docs(readme): ...`
- `refactor(backend): ...`
- `chore: ...`

注意：

- 不要强行把所有提交都写成严格的 Conventional Commits。
- 如果仓库已有更自然的写法，优先贴近仓库已有习惯。
- 不要默认添加 `[skip ci]`，除非用户明确要求，或这次改动明显符合仓库里已有的自动化提交模式。

### 5. 生成一行 message

输出应满足：

- **一行英文、简洁，与仓库风格和写法要求一致**
- **覆盖全部 staged changes**
- **可直接用于提交**

## 写法要求

优先使用以下格式之一：

```text
<type>(<scope>): <summary>
```

或

```text
<type>: <summary>
```

标题规则：

- 使用祈使语气，写现在要做什么，如 `add` / `fix` / `update`
- 首字母不要大写，结尾不要句号
- 不要出现 `WIP`、`misc`、`update files` 这类空泛表述

### type 选择

- `feat`：新增功能、扩展现有能力。
- `fix`：修复 bug、错误行为或明显的 UX 问题。
- `refactor`：重构实现，但主要行为不变。
- `docs`：文档、说明、模板文案等改动。
- `chore`：对于依赖、构建过程等的维护性改动。

### scope 选择

- 涉及功能域的更改，通常需要前后端联合，`scope` 建议写功能域，比如 `account`、`instance`、`intelligence` 等。
- 仅更改前端、后端、CI 工作流、国际化文本、脚本时，`scope` 只写结构域，比如 `frontend`、`backend`、`ci`、`l10n/locale`、`script` 等。
- `docs` 类型的改动，`scope` 可以写 `readme`、`changelog` 等具体的文档范围。
- `chore` 类型的改动，`scope` 可以写 `Tauri`、`nextjs`、`nsis` 等具体依赖名称或术语。
- 若没有明确 `scope` 或者难以概括，允许省略。

示例：

- `fix(frontend): prevent wrong config key updates in resource pack page`
- `feat(launch): support use custom authlib injector in advanced game settings`
- `docs(readme): update install methods`
- `chore: auto update Minecraft version list, add 26.2-rc-2`

## 边界情况

- 如果 staged changes 混合了多类小改动，优先找主目的，再做高层概括。
- 如果改动明显不相关，也仍然给出尽量诚实的一行 summary，不要假装它们只有一个很具体的目的。
- 如果用户没有要求解释，就只返回最终一行。

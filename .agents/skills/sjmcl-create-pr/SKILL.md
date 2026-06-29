---
name: sjmcl-create-pr
description: Create pull requests for SJMCL using the repository PR template and recent git history. Use this skill when the user asks to create/open a PR, draft PR title/body, summarize branch changes for a PR, or otherwise prepare PR content.
---

# SJMCL PR 创建规范

## 目标

一、基于当前分支相对基线分支的全部改动生成 PR，不只看最后一个 commit。  
二、使用仓库自带的 PR 模板，不自行发明新的结构。  
三、PR 标题保持英文，遵循本文档约定的命名方式。  
四、使用 `gh pr create` 真正执行创建 PR 之前，先把 `base`、`title`、`body` 给用户确认。

## 触发场景

只要能判断用户是在请求创建 PR，或者为创建 PR 做准备，就应使用本 skill。  

不要把触发限制成固定说法。即使用户表达很短、很口语，或要求不完整，只要不是在单纯讨论 PR 概念，也应进入本 skill 的工作流。

## 基本规则

### 一、必须以仓库模板为准

始终使用：

```text
.github/PULL_REQUEST_TEMPLATE.md
```

要求：

- 保留模板里的主 section，不要自己改 section 名称。
- 可以删除模板注释和说明性占位文字。

### 二、先分析分支，再写 PR

创建 PR 前，必须先看：

- 当前分支名
- 基线分支
- 当前分支相对基线分支的 commit 列表
- `base...HEAD` 的完整 diff

不要根据工作区未提交内容写 PR，也不要只根据最近一个 commit 写 PR。

### 三、先给草稿，后创建 PR

无论用户是不是说明了“直接创建帮我创建 PR”，都先产出草稿：

1. 生成 `base`、`title`、`body` 草稿，使用表格展示
2. 明确告诉用户：这是准备提交的 PR 内容
3. 让用户确认是否需要二次修改、或者继续创建
4. 只有用户明确确认后，才能真正执行 `gh pr create`

若用户中途要求修改标题、类型、目标分支等，应先更新草稿，再次确认。

### 四、标题和正文要分工明确

- PR 标题：用英文一句话概括本分支最主要的变动。
- PR 正文：说明背景、改法、关联 issue、更新日志影响。

正文不是逐文件流水账。要归纳“为什么改”和“改完后对开发者/用户有什么影响”。

### 五、信息不足时不要硬猜

如果以下信息无法可靠判断：

- 基线分支
- 关联 issue
- 变动类型
- 验证方式

就先给出草稿，标注待确认的项目，不要假装已经确定。

## 执行步骤

### 1. 检查仓库和 PR 环境

建议先确认：

```bash
git status --short
git branch --show-current
git remote -v
gh auth status
```

如果 `gh` 不可用、未登录、当前不在 git 仓库、当前分支不适合提 PR，或仓库远端信息明显不对，就先说明问题，不要继续伪造 PR 结果。

### 2. 确定基线分支

不要默认把 `master` 或 `main` 当作 `base`。按以下顺序判断：

1. 用户明确指定了 `base branch`，直接使用。
2. 否则先用本地 git 线索推断当前分支是从哪条分支切出来的：
   - `git branch -vv`
   - `git reflog show --date=local $(git branch --show-current)`
   - `git symbolic-ref --quiet --short refs/remotes/origin/HEAD`
3. 如果存在多个候选分支，再结合 `git merge-base HEAD <candidate-branch>` 比较分叉点。
4. 若仍无法可靠判断，再退回远端默认分支或仓库默认开发分支。

注意：

- tracking / upstream 只能作为线索，不等于绝对正确的父分支。
- 若判断依然不够确定，要在草稿里明确标注为推断值。

### 3. 收集这条分支会进入 PR 的全部改动

至少查看：

```bash
git log --oneline <base>..HEAD
git diff --stat <base>...HEAD
git diff <base>...HEAD
```

必要时再看：

```bash
git diff --name-only <base>...HEAD
```

不要根据工作区未提交内容写 PR，也不要只根据最近一个 commit 写 PR。

### 4. 读取模板并判断 PR 类型

先读取：

```text
.github/PULL_REQUEST_TEMPLATE.md
```

然后结合完整 diff，判断模板里 `This PR is a ..` 应勾选什么：

- `🆕 New feature`
- `🐞 Bug fix`
- `🛠 Refactoring`
- `⚡️ Performance improvement`
- `🌐 Internationalization`
- `📄 Documentation improvement`
- `🎨 Code style optimization`
- `❓ Other`

要求：

- 以“这条分支的主目的”为准，不要见到逻辑改动就默认勾 `Bug fix`。
- 可以勾多项，但必须克制，优先有一个最主要类别。
- 标题里的 `type` 和模板勾选项要大体一致，但不要求机械一一对应。

### 5. 归纳分支语义和验证信息

根据 `base...HEAD` 的完整改动，至少整理出：

- 这条分支主要解决什么问题
- 采用了什么方式
- 是否有用户可感知的变化
- 本次已经做了哪些真实验证
- 是否有相关 issue、讨论链接或需求来源

### 6. 生成 PR 标题

生成标题前，先看最近提交风格：

```bash
git log --oneline -10
```

标题要求：

- 必须是英文
- 优先使用 `type(scope): summary` 或 `type: summary`
- 优先贴近本仓库近期写法，而不是生硬套通用模板
- 优先写结果，不写过程
- 避免 `update`, `misc changes`, `fix issues` 这类空话

**特殊情况**：如果相对 `base` 只有一条 commit，且该 commit message 已经符合本仓库命名规范、并且能够准确覆盖整条分支的主要目标，可以直接将它作为 PR 标题；否则仍然要基于整条分支重新归纳标题。

标题风格需要继承 `commit-msg` skill 的特点：

- 先判断主目的，再决定 `feat` / `fix` / `refactor` / `docs` / `chore` / `perf`
- 若改动跨前后端但聚焦某个功能域，`scope` 优先写功能域，如 `account`、`instance`、`intelligence`、`launch`
- 若只是结构域改动，再写 `frontend`、`backend`、`ci`、`readme`、`agent`、`l10n`、`i18n`、`nsis` 等 scope
- 若没有明确聚焦对象，可以省略 `scope`

SJMCL 常见写法示例：

- `fix(frontend): prevent duplicate dialog close handling`
- `feat(ci): build and upload portable artifacts in test workflow`
- `docs(agent): add commit message generator skill`
- `chore: auto update Minecraft version list, add 26.2-rc-2`

### 7. 按模板填写 PR 正文

按 `.github/PULL_REQUEST_TEMPLATE.md` 现有结构填写：

- `Checklist`
- `This PR is a ..`
- `Related Issues`
- `Description`
- `Additional Context`

填写要求：

- 删除模板注释和说明性占位文字，但保留 section 名称。
- `Checklist` 只勾选已真实验证的项。
- `This PR is a ..` 选最贴近的类别，不要乱勾。
- `Related Issues` 有真实 issue 或讨论链接就写，没有就保留待补充。
  - 每一个 issue 编号都要加 `fix` / `resolve` / `close`，如 `close #100, resolve #200`。
- `Description` 重点写“要解决什么问题”和“这次怎么解决”，较复杂的时候可以列表格。
  - 若涉及 API、交互或视觉变化，点明外部可感知差异
  - 不要写成逐文件更改流水账
- `Additional Context` 只在有截图、风险、兼容性说明、后续事项时再写。
- 若某项无法可靠判断，要显式标出待确认，不要假装已经确定。

### 8. 先给用户确认

输出时至少包含：

- `Base branch`
- `PR title`
- `PR body`
- 需要用户补充或确认的点

明确告诉用户：这是准备提交的 PR 内容。  
没有明确确认前，不执行创建 PR。

### 9. 用户确认后再创建 PR

只有在用户明确确认后，才执行 `gh pr create`。

执行前再次检查：

```bash
git branch -vv
git remote -v
gh repo view --json nameWithOwner
```

要求：

1. 确认当前分支的 tracking remote 和远端分支正确。
2. 确认 PR 的目标仓库是用户期望的 SJMCL 仓库，不要依赖 `gh` 默认推断。
3. 若需要推送，优先使用明确的远端与分支名，不要盲推到不确定的 fork。
4. 使用已经确认过的 `base`、`title`、`body` 执行创建。

## 输出要求

- 默认输出紧凑的 PR 草稿，不展开长篇分析。
- 如果用户只要草稿，就停在草稿，不继续创建。
- 如果当前信息不完整，要明确指出缺失项。

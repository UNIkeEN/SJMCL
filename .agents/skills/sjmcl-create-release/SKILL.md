---
name: sjmcl-create-release
description: Prepare an SJMCL release by checking commits since the latest release tag, validating the next semver tag, bumping versions, creating the release commit and tag, and drafting bilingual release notes. Use this skill when the user asks to create or prepare a release, bump a release version, create a release tag, or draft/refine release notes for a new SJMCL version.
---

# SJMCL Release 创建规范

## 目标

一、基于上一个正式 release tag 之后的全部 commit 准备新版本发布，不只看最后一个 commit。  
二、先确认 release 元信息和目标版本，再执行版本号变更、release commit 和 tag。  
三、产出脚本生成的 changelog draft，以及 refine 后的中英双语 release notes。  
四、所有过程都以仓库真实脚本、真实 tag、真实版本文件为准，不伪造结果。

## 触发场景

当用户提及以下意图时使用本 skill：

- 创建 release、准备 release、发版
- bump release version / bump tag
- 创建 release tag
- 生成、整理、润色 release notes / changelog draft

不要把触发限制成固定说法。只要用户是在让你推进 SJMCL 的版本发布流程，而不是泛泛讨论 release 概念，就应进入本 skill 的工作流。

## 基本规则

### 一、默认基于最近一个正式 release tag

默认只看形如 `v*` 的正式版本 tag。  
`nightly` 这类非语义化 tag 不作为默认基线，除非用户明确说本次要做 nightly / prerelease。

### 二、先给 meta 信息，再执行 bump

开始 release 流程时，先给用户一个简短 meta 摘要，至少包含：

- 上一个 tag 版本号
- 上一个 tag 时间
- 从上一个 tag 到 `HEAD` 有多少个 commit

在用户确认或默认继续前，不要直接改版本号。

### 三、版本号必须和用户意图、语义化版本关系一致

目标版本号优先从用户当前请求里提取。  
如果用户没说清楚，就先问出目标版本号，或至少问清楚是 `major` / `minor` / `patch` / `prerelease` 哪一种。

不要假装新的 tag 一定合理。  
必须明确判断它和上一个正式 tag 是否构成语义化版本号递进关系；如果不是，或者存在歧义，要先标出来再继续。

### 四、release commit 和 tag 的写法固定

本仓库 release bump 的 commit message 固定使用：

```text
chore(release): bump version to <version>
```

tag 固定使用：

```text
v<version>
```

若用户输入带 `v`，内部归一化为版本号和 tag 两个值分别处理。  
不要自行发明别的 release commit message。

### 五、版本文件核对清单固定为五个

release bump 后，必须检查以下五个文件：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`
- `pnpm-lock.yaml`

如果其中任何一个没有按预期更新，必须明确指出，不要假装已经一致。

### 六、release notes 分成两层产物

release notes 必须同时产出两份内容：

1. 脚本 `scripts/release/generate_changelog_draft.py` 的原始 draft
2. 人工 refine 后的中英双语 release notes

脚本 draft 只是参考输入，不是最终答案。  
最终 release notes 仍然要基于 `last_tag..HEAD` 的真实 commit 和 PR 信息手工归纳。

### 七、prerelease 默认跳过 draft 和 release notes

如果当前目标 tag 带有 `-beta`、`-rc` 等 prerelease 后缀：

- 不执行 changelog draft 步骤
- 不执行 release notes refine 步骤
- 不要求产出中英双语 release notes

只有当前目标 tag 是正式版本时，才执行这些步骤。  
执行这些步骤时，要找“上一个正式版本”作为比较和归纳基线，而不是拿上一个 prerelease tag 当基线。

## 执行步骤

### 1. 检查仓库状态和 release 前提

建议先确认：

```bash
git status --short
git branch --show-current
git tag --sort=-creatordate | sed -n '1,20p'
```

如果当前不在 git 仓库、工作区有明显无关改动、或找不到合适的 release tag 基线，要先说明问题，不要继续执行 release 流程。

### 2. 收集上一个 tag 之后的 meta 信息

默认先定位最近一个正式 release tag，再查看：

```bash
git for-each-ref refs/tags/v* --sort=-creatordate --format='%(refname:short)|%(creatordate:short)|%(subject)' | sed -n '1,10p'
git rev-list --count <last_tag>..HEAD
git log --oneline <last_tag>..HEAD
```

输出时至少给用户：

- `Last tag`
- `Tag date`
- `Commits since last tag`

必要时补一个简短判断，例如：

- 这次更像 patch / minor release
- 自上次发版后改动较多，release notes 需要人工合并

### 3. 确定目标版本号并检查语义化版本关系

按以下顺序处理：

1. 用户明确给了目标版本号，直接使用。
2. 若用户只表达了发版意图，没有说版本号，就先问清楚。
3. 若用户给的是带 `v` 的 tag，拆出纯版本号用于 bump，并保留 `v<version>` 作为 tag。

检查时至少说明：

- 上一个正式版本号
- 目标版本号
- 是否构成合理的 semver 递进

默认判断规则：

- `patch`：主次版本不变，补丁号递增
- `minor`：主版本不变，次版本递增，补丁号通常归零
- `major`：主版本递增
- `prerelease`：必须显式说明预发布标识及其递进关系

如果关系不成立、跳版本过大、稳定版和 prerelease 之间关系不清楚，必须先让用户确认。

### 4. 执行版本号 bump、release commit 和 tag

确认目标版本号后，按顺序执行：

```bash
pnpm run version bump <version>
git add .
git commit -m "chore(release): bump version to <version>"
git tag v<version>
```

要求：

- 每一步都要检查退出状态和错误输出。
- 任一步失败就停止，不要继续假装 release 已完成。
- `git add .` 之前先确认本次要提交的内容确实只包含 release 相关变更；若混入无关改动，要先向用户指出。

### 5. 检查五个版本文件并形成核对清单

完成 release commit 和 tag 后，重新读取以下五个文件的版本信息：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`
- `pnpm-lock.yaml`

形成一份紧凑核对清单，至少包含：

- 文件路径
- 实际版本号
- 是否与目标版本一致

如果 `src-tauri/Cargo.lock` 没有更新到目标版本，要明确标为异常，不要默认这是正常结果。

如果只有 `src-tauri/Cargo.lock` 没同步，而 `src-tauri/Cargo.toml` 已经是目标版本，先运行：

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

再重新读取 `src-tauri/Cargo.lock`；不要使用 `cargo update`。

### 6. 输出第一阶段确认材料

在 push 之前，必须先输出第一阶段确认材料，并停下来等用户确认。

第一阶段至少包含：

- `Last tag / tag date / commits since last tag`
- `Target version / target tag`
- semver 关系判断
- release commit 和本地 tag 是否已创建
- 五个版本文件的核对清单
- 仍需用户确认的异常项或歧义

只有用户明确确认后，才进入下一阶段。

### 7. push 当前分支和 tag

用户确认第一阶段内容后，才 push 当前分支和 tag。

建议至少执行：

```bash
git push <remote> <current_branch>
git push <remote> v<version>
```

要求：

- 不要只在本地创建 tag 就继续运行后续步骤。
- 必须确认 tag push 成功后，才能继续后续步骤。
- 如果远端、分支名、push 目标不明确，要先让用户确认，不要默认推送到错误的 remote。

### 8. 正式版时运行 changelog draft 脚本

只有当前目标 tag 是正式版本时，才执行本步骤。  
如果当前目标 tag 带有 `-beta`、`-rc` 等后缀，跳过本步骤和下一步，直接进入第二阶段结果输出。

分支与 tag push 成功后，运行：

```bash
python scripts/release/generate_changelog_draft.py
```

要求：

- 保留脚本原始输出，作为 `draft` 单独展示。
- 若脚本报错，直接展示错误，不要伪造 draft。
- 要明确告诉用户：这个脚本依赖 GitHub 上已有的 tag 信息，所以必须在 tag push 成功之后再执行；且应以“当前目标版本的上一个正式版本”为比较基线；输出只能作为参考草稿，不等于当前待发布版本的最终 release notes。

### 9. 正式版时整理 refine 后的 release notes

只有当前目标 tag 是正式版本时，才执行本步骤。

在整理最终 release notes 前，必须先完整阅读：

```text
references/changelog-refine.md
```

然后基于：

- `git log --oneline <last_stable_tag>..HEAD`
- commit 里的 PR 编号
- 第 8 步的脚本 draft

整理出 refine 后的中英双语 release notes。

### 10. 输出第二阶段结果

push 成功后，再输出第二阶段结果。

如果当前目标 tag 是正式版本，第二阶段至少包含：

- push 结果
- script draft
- refine 后的 English release notes
- refine 后的 中文 release notes

如果当前目标 tag 是 prerelease，第二阶段至少包含：

- push 结果
- 当前 tag / 当前 commit 状态
- 是否还有后续需要人工执行的发布动作

如果用户只让你准备 release，而没有明确要求创建 GitHub Release，就停在这里，不要继续代替用户发布远端 release。

## 输出要求

- 默认分两个阶段输出，不要把 push 前确认材料和 push 后结果混在一起。
- 第一阶段只输出本地 release 结果和确认项，不输出 draft / refine。
- 第二阶段只有在用户确认且 push 成功后才输出。
- 默认输出紧凑，不写长篇过程复盘。
- 所有元信息、版本号、tag、commit 数都要来自真实 git 结果。
- release notes 重点写变化和影响，不写逐文件流水账。
- 如果脚本 draft 与人工归纳不一致，优先以真实 `last_stable_tag..HEAD` 改动为准，并把 draft 明确标成参考。

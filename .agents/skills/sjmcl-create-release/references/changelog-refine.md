# Release Notes Refine 规范

当前目标 tag 如果带 `-beta`、`-rc` 等 prerelease 后缀，就不要读这个文件，直接跳过 release notes refine。

## 对齐基准

先对齐仓库现有 changelog，再开始写：

- 英文基准文件：`CHANGELOG.md`
- 中文基准文件：`docs/CHANGELOG.zh-Hans.md`

先读这两个文件里最近几个版本的条目。  
refine 的用词、句式、分组方式都要直接贴近它们，不要自己发明一套新的发布文风。

## 归纳规则

- 目标是把 `last_stable_tag..HEAD` 之间的真实变更整理成一份英文 release notes 和一份中文 release notes，并和 `scripts/release/generate_changelog_draft.py` 的原始输出一起交给用户。
- 信息来源优先级：`git log --oneline <last_stable_tag>..HEAD` > commit 自带 PR 编号 > 用户当前说明 > 脚本 draft。
- 脚本 draft 只是参考，不是最终真相来源。
- 如果某个 PR 是普通 merge 合入，`Merge ...` commit 本身不要写进最终条目；要继续看实际带入的 commit，并尽量把对应 PR 编号补回真实变更。
- 如果无法可靠判断某条变更对应哪个 PR，就不要编造 PR 编号；按“无 PR 号 commit”处理。
- 每个分类内部按 PR 编号从小到大排列。
- 多个 PR 或多个相似更改可以合并成一条，但要保留相关 PR 编号，按升序列出。
- 没有 PR 编号的条目放在对应分类最后，只保留作者。

## 分类与格式

分类顺序固定如下，没有内容的分类可以省略，但顺序不能变：

1. `🔥` 重大功能更新
2. `🌟` 更新，feat
3. `🐛` 修复，fix
4. `⚡️` 性能优化，perf
5. `🛠` 逻辑调整 / 重构，refactor
6. `💄` 代码风格优化
7. `🌐` 国际化
8. `📦` 构建和依赖更新
9. `Extensions`
10. `Workflow`
11. `Web & Docs`

分类时优先看“用户最感知到的主结果”：

- `feat(...)` 优先归入 `🌟`
- `fix(...)` 优先归入 `🐛`
- `perf(...)` 优先归入 `⚡️`
- `refactor(...)` 优先归入 `🛠`
- `style(...)` 或纯样式整理归入 `💄`
- `fix(i18n)` / `fix(l10n)` / 纯翻译文案更新优先归入 `🌐`
- 依赖、构建、版本、打包、发布链路更新优先归入 `📦`
- 扩展系统相关改动优先归入 `Extensions`
- CI、workflow、自动化脚本优先归入 `Workflow`
- 网页、文档、agent 文档等更贴近展示层的内容优先归入 `Web & Docs`

格式必须对齐仓库现有 changelog：

- `🔥`、`🌟`、`🐛`、`⚡️`、`🛠`、`💄`、`🌐`、`📦` 直接写成普通 bullets
- `Extensions:`、`Workflow:`、`Web & Docs:` 写成分组条目，再在其下写二级 bullets
- 不要写 `###` 这类小标题
- 英文在前，中文在后，中间用 `---` 分隔
- 句尾按仓库现有样式直接补 `#xx @xxx`
- 没有 PR 编号时，只保留 `@xxx`
- 不要改写成括号格式，如 `(#1234)`

英文用词优先沿用现有 changelog 的表达习惯，如 `Support ...`、`Fix ...`、`Update ...`、`Add ...`。  
中文用词优先沿用现有 changelog 的表达习惯，如 `支持...`、`修复...`、`更新...`、`新增...`、`调整...`。  
不要写成机械直译腔，也不要写成和现有 changelog 风格差异很大的营销文案。

## 示例

单 PR：

```text
- 🌟 Support automatically refreshing expired Microsoft account access tokens. #1627 @tangge233
- 🌟 支持在微软账户 Access Token 过期后自动刷新。#1627 @tangge233
```

多 PR 合并：

```text
- 🐛 Fix display issues in the re-login modal and the extension list page. #1646 #1660 @baiyuansjtu
- 🐛 修复重新登录对话框与扩展列表页面的显示问题。#1646 #1660 @baiyuansjtu
```

没有 PR 编号：

```text
- 📦 Update Tauri core libraries and plugins to the latest versions. @UNIkeEN
- 📦 更新 Tauri 核心库及其插件至最新版本。@UNIkeEN
```

分组条目：

```md
- Extensions:
   - Add `Chakra.Table` rendering mappings to the `MarkdownContainer` component for extension usage. #1649 @zaixiZaixiSJTU
- Workflow:
   - Add a workflow to automatically upload releases to Winget. SJMCL can now be conveniently installed via Winget on Windows. #1639 @pangbo13
```

```md
- 扩展：
   - 为 `MarkdownContainer` 组件新增 Chakra 表格渲染映射，供扩展使用。#1649 @zaixiZaixiSJTU
- 工作流：
   - 新增发版时自动上传 Winget 的工作流，现在可以通过 Winget 便捷安装 SJMCL（Windows 平台）。#1639 @pangbo13
```

最终结果结构：

```md
**English**

- 🔥 ...
- 🌟 ...
- Extensions:
   - ...
- Workflow:
   - ...

---

**简体中文**

- 🔥 ...
- 🌟 ...
- 扩展：
   - ...
- 工作流：
   - ...
```

## 检查

- 是否覆盖了 `last_stable_tag..HEAD` 的主要改动，而不是只覆盖脚本 draft
- 是否按规定顺序排列分类
- 是否在分类内按 PR 编号升序排列
- 是否把相似 PR 做了合理合并
- 是否同时产出了英文和中文版本
- 是否清楚区分了“脚本 draft”和“refine 后的最终 release notes”

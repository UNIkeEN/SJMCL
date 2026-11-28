---
name: sjmcl-frontend-dev-preview
description: Reproduce visible SJMCL bugs and compare UI changes using real launcher pages with mock data. Capture screenshots or GIFs for local review or issue and PR discussions.
---

# SJMCL 前端页面预览

## 目标

一、用 SJMCL 的实际页面复现界面问题或验证界面改动。
二、生成截图或动图，供本地检查或 issue、PR 讨论使用。

## 触发场景

- 复现前端 Bug。
- 对比界面改动前后的布局、交互或动画。
- 为 issue 或 PR 评论页面截图、操作动图或前后对照。

注意：单组件调试或预览请使用 [sjmcl-frontend-component-test](../sjmcl-frontend-component-test/SKILL.md)。

## 基本规则

### 一、用实际页面复现场景

定位目标页面和触发操作，复用 `src/pages/_app.tsx`、实际布局和组件。按需用路由 mock 进入目标页，再用 Tauri `mockIPC` 模拟 Tauri command 的返回值和请求时机。

例如，复现列表续载时先返回首批数据和游标，再挂起下一页请求。[新闻续载示例](examples/news-load-more.md)

### 二、在独立的无头浏览器中预览

- 通过 Playwright 或 Chromium DevTools Protocol 在独立的无头浏览器中操作和截图，使用临时 profile 和独立的本机预览端口。禁用 Computer Use。
- 连接和清理仅限本次启动的预览服务和无头浏览器，避免影响用户正在使用的启动器和浏览器进程。
- 若用户没有特殊要求，视口按目标平台的启动器默认主窗口设置，macOS 和 Linux 为 800 × 550，Windows 为 820 × 550。触发目标状态后，等界面和字体就绪再捕获。

### 三、按要展示的变化选择素材

- 用截图记录布局、加载占位或某一步的结果。取景保留必要的页面标题、控件和状态。
- 用动图记录动画、状态切换或只在操作中出现的问题。采样完整过程，检查导出画面的循环衔接。
- 对比新旧实现时使用相同的模拟数据、主题、语言、视口和操作。并排展示对照素材，多个相似场景可选代表截图并注明覆盖范围。

### 四、遮蔽真实信息

用仓库默认配置和示例数据替换账户、令牌、目录路径、服务器地址等等可能敏感的开发者信息。交付前检查截图、动图每一帧、文件名和说明。含真实信息的素材先裁剪或用实色遮盖，再重新导出。

### 五、交付素材

提供素材和简短的场景说明，标明模拟数据。对外发布（如上传并评论于 GitHub）前确认用户已明确授权发布的目标和内容。发布后核对素材的渲染效果。

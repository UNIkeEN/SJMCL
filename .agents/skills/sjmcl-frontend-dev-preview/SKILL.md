---
name: sjmcl-frontend-dev-preview
description: Preview SJMCL components in a browser without tauri dev. Use when developing frontend styles and interactions, or showing changes to a developer.
---

# SJMCL 前端开发预览

修改前端样式或交互逻辑时，可以用这里的预览环境在浏览器调试，而无需启动 `tauri dev`。预览框架已接入项目的 Chakra 主题、全局样式和国际化组件，并支持切换语言和深浅色。

## 编写组件

新建一个默认导出 React 组件的 TSX 文件，在其中导入要测试的组件或页面，并提供所需的 props，可以参考[添加服务器弹窗的示例代码](examples/add-server/preview.tsx)。`@/` 仍然指向仓库的 `src/`，`public/` 下的资源也可以直接使用。

如果组件依赖后端服务或应用上下文，参考示例中的 [preview.mjs](examples/add-server/preview.mjs) 和 [mocks.ts](examples/add-server/mocks.ts)，用 `alias` 替换相应模块。mock 只需提供组件会用到的数据和方法。配置中的路径相对于配置文件。

## 启动预览

安装好项目依赖后，在仓库根目录执行，将 TSX 文件传入启动脚本：

```bash
node .agents/skills/sjmcl-frontend-dev-preview/scripts/serve.mjs /tmp/my-preview.tsx
```

使用 mock 时，传入配置文件：

```bash
node .agents/skills/sjmcl-frontend-dev-preview/scripts/serve.mjs /tmp/my-preview/preview.mjs
```

不传参数时，会默认启动添加服务器弹窗的示例。打开终端输出的地址即可查看，修改源码后页面自动刷新、修改配置后需要重启服务。

默认端口是 `3176`，需要时可通过 `PORT` 更换。

## 在浏览器中检查

预览服务启动后，用当前环境提供的浏览器工具打开终端输出的地址。例如，使用 Playwright 时通过 `page.goto(url)` 访问；使用电脑操作工具 CUA 时，可先调用 `cua.getApp("Google Chrome")` 打开或连接 Chrome，再通过地址栏访问预览。**具体调用方式以具体情况为准，用户指定了浏览器就使用该浏览器**。

操作本次修改涉及的控件，检查显示效果和控制台错误，按需调整窗口大小、语言和深浅色。

回复时说明实际检查了什么、哪些数据用了 mock。需要给开发者查看效果时，请保留服务并附上预览地址。

涉及后端逻辑的真实实现时，仍需在 Tauri 中测试验证。

# 示例 · Minecraft 新闻续载

用首批模拟文章铺出列表，再保留下一页的等待状态。适合展示首屏加载、滚动续载或更换加载动画前后的效果。

## 准备页面

在系统临时目录创建预览 fixture。用项目的 esbuild 打包真实的 `src/pages/_app.tsx` 和 `src/pages/discover/minecraft-news.tsx`，从 `public/` 提供字体和图片。让本地服务自动选择端口，通过 alias 把 `next/router` 指向路由 mock 并设定 `pathname` 为 `/discover/minecraft-news`。

用 Tauri 的 `mockWindows` 和 `mockIPC` 模拟主窗口与 IPC。配置用 `structuredClone(defaultConfig)` 作为起点。要展示正常页面，把 `mocked` 设为 `false`。实例、账号和任务列表可用空数组，页面数据采用示例文章和测试地址。

在 `mockIPC` 的命令分支里控制分页时机。项目服务层会封装响应，此处返回后端原始数据。

```ts
case "fetch_news_post_summaries": {
  const { url, cursor } = (args as { requests: NewsPostRequest[] }).requests[0];
  return cursor === null ? { posts, cursors: { [url]: 1 } } : pending;
}
```

这里的 `posts` 是模拟文章，`pending` 是保持等待的 Promise。首屏加载的预览可以直接在第一次请求时返回 `pending`。

## 进入续载状态

等待首批文章出现，把列表尾部滚入视口。确认页面已发出带游标的请求，且已有文章和尾部加载提示同时可见，再按技能中的方法捕获素材。

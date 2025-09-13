[English](../CHANGELOG.md) · **简体中文**

SJMCL 遵循 [语义化版本规范 2.0.0](https://semver.org/lang/zh-CN/)。

## 0.3.1

`2025-09-13`

- 🐛 修复登录流程中 设备授权响应 与 账户资料 可能不完整的问题。#875 @Reqwey
- 🐛 修复通过 OAuth（Ygg Connect 提案）登录到第三方认证源时玩家信息不完整的问题。#882 @Reqwey
- 🐛 修复使用邮箱密码登录到第三方认证源时访问令牌可能无效的问题。#885 @Reqwey
- 🛠 重构系统工具类方法的前端接口函数。#883 @baiyuansjtu
- 📦 更换新的 SJTU 紫气东来门内置背景。@UNIkeEN @GNWork
- 工作流：
   - 自动上传发布构建产物到 SJMC 的自有服务器。#880 @Minecrafter-Pythoner @hans362

## 0.3.0

`2025-09-05`

- **🔥 在下载页面添加模组名称的简体中文翻译，支持中文搜索。#851** @SundayChen @UNIkeEN
- 🌟 在下载页面添加部分资源描述的简体中文翻译。#851 @SundayChen
- 🌟 支持从模组信息对话框跳转至对应的 MCMod 页面。#851 @SundayChen
- 🌟 支持 Windows Arm64 平台。#867 @Minecrafter-Pythoner
- 🐛 修复联网配置同步时令牌计时更新失效的问题。#852 @Nova-Squ1
- 🐛 修复因重试下载模组加载器导致启动参数重复的问题。#860 @Reqwey
- 📦 更新前端依赖 next 至最新版本。#869 @dependabot[bot]
- 工作流:
   - 同步前端的 npm 和 pnpm 锁定文件。#861 #862 @pangbo13 @Minecrafter-Pythoner

## 0.2.0

`2025-08-22`

- 🔥 **支持整合包的导入与安装。#792** @Reqwey @UNIkeEN  
- 🔥 **在创建 Fabric 实例时自动下载 Fabric API 模组。#844** @SundayChen  
- 🌟 支持启动游戏时直接进入存档（快速单人模式）。#788 @baiyuansjtu  
- 🌟 支持启动旧版本游戏时直接进入服务器（快速多人模式）。@UNIkeEN  
- 🌟 下载模组时新增前置依赖模组的提示。#794 @SundayChen  
- 🌟 在 Java 下载对话框中添加 BellSoft 分发源的跳转支持。#806 @baiyuansjtu  
- 🌟 新增面向新用户的沉浸式功能导览。#821 @UNIkeEN  
- 🌟 基于 crashmc 网站新增更多游戏崩溃时的日志分析匹配规则。#826 @itray25  
- 🌟 优化实例创建、模组更新及资源下载过程中的用户界面与操作体验。@itray25 @SundayChen  
- 🐛 修复资源下载对话框自动筛选游戏版本错误的问题，异常情况默认显示全部游戏版本。#790 @SundayChen  
- 🐛 修复因 classpath 重复导致的启动错误。@Reqwey  
- 🐛 修复启动按钮的快速跳转因未编码实例 ID 产生的路由错误。#795 @UNIkeEN  
- 🐛 修复截图与世界列表页面中的排序错误；页面挂载时自动刷新截图。@UNIkeEN  
- 🐛 修复游戏时长记录错误的问题。#815 @UNIkeEN  
- 🐛 修复 Windows 平台下自定义游戏窗口标题无效的问题。#827 @ModistAndrew  
- 🐛 修复因（第三方认证源）账户令牌过期，无法进入游戏服务器的问题。#846 @Reqwey  
- ⚡️ 避免在版本比较中不必要的缓存回退请求。#799 @UNIkeEN  
- ⚡️ 使用并发 future 提升游戏文件校验速度。#819 #836 @xunying123  
- 💄 重构部分代码以提升代码风格与可维护性。  
- 📦 DMG 安装包文件本身现使用全新设计的磁盘图标，与应用图标相区分。@Neuteria  
- 📦 更新 Tauri 核心库及其插件。  
- 工作流：  
   - 修复夜间构建流程中的版本号问题。#791 @Minecrafter-Pythoner  
   - 从差异的提交信息生成 changelog 草稿，用于版本发布。#793 @pangbo13  
   - 跟随 CodeQL 指引，为 GitHub Actions 工作流文件添加权限。#817 @Minecrafter-Pythoner  

## 0.1.1

`2025-08-01`

- 🌟 添加对 HMCL 自定义 JVM 参数 `primary_jar_name` 的支持。#756 @Reqwey  
- 🌟 导出的崩溃报告中现在包含完整的启动命令。#775 @UNIkeEN  
- 🌟 启动页新增按钮，用于快捷跳转至实例设置页面。#777 @UNIkeEN  
- 🐛 修复搜索 CurseForge 资源时无法连接服务器的问题。 
- 🐛 修复删除实例后路由错误及实例数据获取失败的问题。#758 @UNIkeEN  
- 🐛 修复启动过程中手动取消，弹出游戏错误窗口的问题。#761 @Reqwey  
- 🐛 修复实例详情页基本信息组件的文本换行问题。#766 @UNIkeEN  
- 🐛 修复每次启动前未刷新 Java 列表的问题。#772 @UNIkeEN  
- 🐛 修复上传同名自定义背景图时缓存未更新的问题。#776 @baiyuansjtu  
- 🐛 修复启动命令工作目录设置不正确的问题。#778 @xunying123  
- 🐛 修复资源下载中的用户体验问题，与当前实例匹配的的资源版本将自动展开。#783 @UNIkeEN  
- 🛠 将游戏日志文件移动至指单独的缓存目录。#765 @UNIkeEN  
- 🛠 现在 portable 版本的启动器配置文件和预定义游戏目录位于启动器所在目录。#779 @UNIkeEN  
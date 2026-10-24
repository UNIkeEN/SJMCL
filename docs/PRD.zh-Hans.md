# 仙建世界客户端 PRD

| 项目 | 内容 |
| --- | --- |
| 产品名称 | 仙建世界客户端（Xianjian Client） |
| 内部代号 | XJMC Launcher |
| 技术底座 | [SJMCL](https://github.com/UNIkeEN/SJMCL)（GPLv3 + 附加条款）二次开发 |
| 当前版本 | `0.1.0` |
| 目标平台 | Windows 10/11、macOS 10.15+、Linux（webkit2gtk 4.1+） |
| 文档状态 | 草案，随 S0 实现同步更新 |

---

## 1. 背景与问题

仙建世界（西安建筑科技大学 MC 社）目前以 **PCL2 + 群文件分发包 + 图文手册** 的方式引导新玩家。手册描述的实际路径是：

1. 在群文件下载 Java 安装包并手动安装；
2. 下载客户端 ZIP 并解压，得到 `.minecraft` 与 PCL2；
3. 到皮肤站注册（需要管理员发放邀请码，并实名登记）；
4. 在 PCL2 中依次点击：版本设置 → 设置 → 滑到底 → 登录方式改为「第三方登录: Authlib Injector」→ 填写认证服务器与注册链接；
5. 输入皮肤站账号密码启动游戏；
6. 进入多人游戏，双击服务器条目；
7. 在登录服完成注册/登录、右键 NPC 传送到生存服；
8. 等待管理员添加白名单；进入二区必须先在一区传送，否则可能丢失背包。

### 1.1 断点分析

| # | 环节 | 失败方式 | 能否由启动器解决 |
| --- | --- | --- | --- |
| 1 | 安装 Java | 版本/位数装错 | ✅ 可自动化 |
| 2 | 分发包与杀软 | PCL2 被误删、解压层级错误 | ✅ 安装包 + 签名 |
| 3 | 皮肤站注册 | 邀请码与实名审核需人工 | ❌ 需后台 |
| 4 | 认证服务器配置 | 6 步点击 + 手抄 URL，易错 | ✅ 可预置 |
| 5 | 账号登录 | 密码错误被误判为启动器故障 | ✅ 可引导 |
| 6 | 进服 | 防火墙、刷新过频被屏蔽 | ⚠️ 部分 |
| 7 | 白名单 | 人工审批 | ❌ 需后台 |
| 8 | 二区传送规则 | 不看文档直接 `/server` 导致丢背包 | ❌ 服务端，启动器可提示 |

结论：**本期只解决 1、2、4、5、6 中可由客户端承担的部分**，3、7、8 依赖社团后台与服务端插件，另行立项。

## 2. 产品目标

### 2.1 定位

面向本校及友校玩家的、开箱即可进入「仙建世界」的 Minecraft 启动器：下载安装后无需查阅手册即可完成「注册 → 登录 → 进服」。

### 2.2 量化目标

| 指标 | 现状 | 目标 |
| --- | --- | --- |
| 新玩家从拿到安装包到进入主城 | 20~40 分钟（含等待人工） | ≤ 8 分钟（人工环节除外） |
| 因配置错误导致的求助 | 占群内提问多数 | 下降 70% |
| 因客户端文件被误删/解压错误导致的求助 | 常见 | 归零 |

### 2.3 非目标（本期明确不做）

- 不自研启动内核，不重写下载/启动/实例管理逻辑；
- 不做 CurseForge / Modrinth 的商店化改造；
- 不做多社团 SaaS 化；
- 不删除上游功能（扩展系统、MCP、发现页保持原样）。

## 3. 方案选型

选择 **基于 SJMCL 二开**，而非自研，理由：

1. SJMCL 已具备实例管理、加载器安装、整合包导入、authlib-injector、JRE 自动下载等全部底层能力；
2. 其扩展系统允许后续以「扩展包 + 配置」的形式叠加社团功能，不必持续改动内核；
3. 自研达到同等完成度需 3~6 个月，而社团的实际诉求集中在「开箱即用」，不在启动内核。

约束：**只加不删、差异最小化、保留 rebase 能力**。删除上游代码会持续放大与上游的合并冲突。

## 4. 本期范围（S0，已实现）

| 需求 | 实现方式 | 位置 |
| --- | --- | --- |
| 品牌与标识 | `productName`、`identifier`、窗口标题、版本号 | `src-tauri/tauri*.conf.json`、`package.json`、`Cargo.toml` |
| 预置认证服务器 | 在 `PRESET_AUTH_SERVERS` **追加**仙建世界皮肤站 | `src-tauri/src/account/helpers/authlib_injector/constants.rs` |
| 更新通道 | 改接社团更新服务（Downloader），移除上游更新源 | `src-tauri/src/launcher_config/helpers/updater.rs` |
| 默认下载源 | 全新安装默认走 BMCLAPI 镜像 | `src-tauri/src/launcher_config/models.rs` |
| 合规 | 统计上报版本号前缀 `XJ-`、README 与关于页归属声明 | `utils/sys_info.rs`、`README.md`、`src/locales/*` |
| 多语言 | 7 种语言的品牌文案替换 | `src/locales/*.json` |

### 4.1 品牌

- 显示名：**仙建世界客户端**；英文/拉丁语言环境：`Xianjian Client`。
- identifier：`com.xauatcraft.launcher`（决定用户数据目录，发布后不可再改）。
- 版本号独立于上游，从 `0.1.0` 起算。

### 4.2 预置认证服务器

在保留上游 3 个预置项的前提下追加：

```
https://skin.xauatcraft.com/api/yggdrasil
```

依据 `LICENSE.EXTRA` 第 3 条，「仅增加预置认证服务器」的改动可继续使用原名分发；但由于本期还包含品牌与其它改动，仍按第 1、2 条履行改名与声明义务。

> 说明：若后续要让皮肤站支持 Yggdrasil Connect 的 OAuth 登录（而非账号密码），需在皮肤站注册 client_id 并登记到 `CLIENT_IDS`。本期不做。

### 4.3 更新通道

更新检查与下载全部走 iOS Club 的 Downloader 服务。构建期通过环境变量注入：

| 变量 | 含义 |
| --- | --- |
| `XJMC_UPDATE_BASE` | 服务地址，例如 `https://download.example.com`，不带结尾斜杠 |
| `XJMC_UPDATE_APP_ID` | 该客户端在服务中对应的应用 ID |

两者任一为空时，**启动器不进行更新检查**（不会回落到上游地址）。

接口：`GET {XJMC_UPDATE_BASE}/api/app/{XJMC_UPDATE_APP_ID}/latest`

```json
{
  "appId": "…",
  "appName": "仙建世界客户端",
  "releaseId": "0.1.1",
  "releaseDate": "2026-11-01T10:00:00Z",
  "context": "更新说明（Markdown）",
  "softs": [
    { "id": "…", "name": "Windows 安装版", "softUrl": "https://…/files/…/SJMCL_0.1.1_windows_x86_64_setup.exe" },
    { "id": "…", "name": "macOS", "softUrl": "https://…/files/…/SJMCL_0.1.1_macos_aarch64.app.tar.gz" }
  ]
}
```

选择规则：按 `softUrl` 中的平台/架构关键字打分，**必须命中当前操作系统**才会被选中，否则视为无可用更新。

安装包命名约定（与现有 CI 产物一致，供匹配使用）：

```
SJMCL_<version>_<os>_<arch>_setup.exe     # Windows NSIS 安装版
SJMCL_<version>_<os>_<arch>_portable.exe  # Windows 便携版
SJMCL_<version>_<os>_<arch>.app.tar.gz    # macOS（内部为 仙建世界客户端.app）
SJMCL_<version>_<os>_<arch>_portable      # Linux 便携版
SJMCL_<version>_<os>_<arch>.deb / .rpm    # Linux 安装包
```

各平台安装行为：

- Windows 安装版：运行安装器（`/UPDATE /P`），便携版：脚本替换 exe 后重启；
- macOS：等待进程退出后解包替换 `.app`，重开；
- Linux：赋予可执行权限后交给 `xdg-open` 打开（本期不做原地替换）。

### 4.4 合规清单

| 条款 | 要求 | 状态 |
| --- | --- | --- |
| 附加条款 1 | 使用与 SJMCL 不同的名称 | ✅ 已完成 |
| 附加条款 2 | README / 关于页显著声明基于 SJMCL 并给出源仓库地址 | ✅ 已完成 |
| 附加条款 3/统计 | 修改版需向统计服务上报带 ≥2 字母前缀的版本号 | ✅ `XJ-` |
| 预置接口限制 | 只允许追加，不得删改原有预置项 | ✅ 保留 3 项 |
| GPLv3 | 分发版本的完整源码必须公开 | ⏳ 需建立公开仓库 |

## 5. 后续迭代

### S1 开箱闭环（约 3~4 人日）

- **首启引导**：检测无 Java → 一键安装；检测无账号 → 引导注册皮肤站并添加账号；检测无实例 → 引导导入整合包。
- **预置服务器**：创建实例或首次启动时写入 `servers.dat`（`play.xauatcraft.com` + 子服说明）。
- **关于页**：补充社团官网、QQ 群、皮肤站入口；源代码卡片改为本仓库地址（上游保留在致谢区）。

### S2 社群功能（依赖后台，约 4~5 人日）

- 邀请码申请与审核状态查询；
- 白名单申请与状态查询（只读 API，客户端不直连 RCON）；
- 服务器在线状态与在服人数展示（放在首页小组件）。

> 前置条件：Blessing Skin 侧提供邀请码/白名单接口。若后台尚未立项，S2 顺延。

### S3 发布工程（约 3~4 人日）

- 产物前缀改为 `XJMC_`，同步修改 `build.yml` / `release.yml` / `sign-macos.yml`；
- 停用上游专用发布流程（winget / AUR / snap / post-release-publish / nightly）；
- Windows 代码签名证书、macOS 公证；
- 自建更新资产上传脚本（对齐 Downloader 的 `POST /api/app/{id}`、`POST /api/release`、`POST /api/soft/upload`）；
- 图标、安装器侧边图、DMG 背景等品牌素材替换。

## 6. 技术设计要点

- **发布版本判定**：更新检查仅在 `build_type == Release` 且当前版本为合法 semver 时执行，本地开发构建不会弹更新。
- **失败静默**：更新接口不可用时只记录日志，不阻断启动。
- **镜像策略**：默认 `mirror`（BMCLAPI 优先），设置页仍可切回官方源或自动。
- **数据目录隔离**：`identifier` 变更使本客户端与官方 SJMCL 的配置、账号、实例互不干扰。
- **与上游同步**：每两周 rebase 一次；品牌差异集中在 `tauri*.conf.json`、`constants.rs`、`updater.rs`、`locales/*`、`README.md`、`docs/`。

## 7. 里程碑

| 阶段 | 内容 | 产出 |
| --- | --- | --- |
| S0 | 品牌、预置认证、更新通道、合规 | 可编译可发版的分叉骨架 |
| S1 | 首启引导、服务器预置 | 首个面向新生的可用版本 |
| S2 | 邀请码、白名单 | 减少人工审批 |
| S3 | 签名、发布流水线 | 正式对外分发 |

## 8. 验收标准

**S0**

1. `pnpm build` 通过，`tsc --noEmit` 无错误，7 个语言文件 key 完全一致；
2. 首次启动时账号页的认证服务器列表中可直接看到「仙建世界皮肤站」，无需手动添加；
3. 关于页同时展示「基于 SJMCL 开发」与上游仓库地址；
4. 未配置更新服务变量时，启动不报错、不弹更新；
5. 配置后，`0.1.0` → `0.1.1` 可完成检查、下载、安装、重启；
6. macOS 与 Linux 构建产物可正常启动。

**S1**

7. 全新机器上，从安装到进入主城不超过 8 分钟，且全程不需要手动改认证服务器设置。

## 9. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| 上游频繁更新导致 rebase 冲突 | 维护成本上升 | 差异集中在少量文件、只加不删、双周同步 |
| 无代码签名 → 杀软误报 | 与 PCL2 相同的老问题 | 优先发安装包、申请证书、提交误报申诉 |
| 更新服务不可用 | 用户卡在旧版本 | 失败静默；保留「手动下载」入口 |
| identifier 变更 | 老用户配置丢失 | 发布前定死，本期已确定 |
| 用户协议仍指向上游 | 合规瑕疵 | S1 前补齐本次发行版协议 |
| 邀请码/白名单无接口 | 人工审批仍是瓶颈 | 客户端只做入口，后台单独立项 |

## 10. 待决事项

1. 更新服务的正式域名与 App ID（阻塞 S0 的发布验证）；
2. 皮肤站是否提供邀请码/白名单接口，以及接口鉴权方式；
3. 图形资源（图标、启动图、安装器素材）的提供方与交付时间；
4. 是否采购 Windows 代码签名证书。

## 附录 A：与上游的差异清单

| 文件 | 改动 |
| --- | --- |
| `src-tauri/tauri.conf.json`、`tauri.{macos,windows,linux}.conf.json` | 产品名、identifier、窗口标题、版本 |
| `src-tauri/src/account/helpers/authlib_injector/constants.rs` | 追加 1 个预置认证服务器 |
| `src-tauri/src/launcher_config/helpers/updater.rs` | 更新源改为社团服务，重写检查与下载逻辑，新增 Linux 安装 |
| `src-tauri/src/launcher_config/commands.rs`、`models.rs` | `VersionMetaInfo.fileName` → `downloadUrl` |
| `src-tauri/src/utils/sys_info.rs` | 统计版本前缀 |
| `src-tauri/build.rs`、`.env.template` | 转发并声明 `XJMC_*` 构建变量 |
| `src/models/config.ts`、`src/components/modals/notify-new-version-modal.tsx` | 同步字段；Linux 改为应用内下载 |
| `src/locales/*.json` | 品牌文案（7 语言） |
| `README.md` | 分叉声明与来源标注 |
| `.github/workflows/build.yml`、`sign-macos.yml` | macOS 包名、更新服务变量 |

## 附录 B：本地构建

```bash
pnpm install
cp .env.template .env        # 填入 XJMC_UPDATE_BASE / XJMC_UPDATE_APP_ID
pnpm tauri dev               # 开发调试
pnpm tauri build             # 打包（需 Rust 工具链）
```

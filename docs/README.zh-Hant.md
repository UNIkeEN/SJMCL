<img src="figs/banner.png" alt="SJMCL" />

[![Test Build](https://img.shields.io/github/actions/workflow/status/UNIkeEN/SJMCL/test.yml?label=test%20build&logo=github&style=for-the-badge)](https://github.com/UNIkeEN/SJMCL/blob/main/.github/workflows/test.yml)
![Downloads](https://img.shields.io/github/downloads/UNIkeEN/SJMCL/total?style=for-the-badge)
![Stars](https://img.shields.io/github/stars/UNIkeEN/SJMCL?style=for-the-badge)
![Runs](https://img.shields.io/badge/dynamic/json?color=blue&style=for-the-badge&label=runs&query=$.total_count&url=https%3A%2F%2Fmc.sjtu.cn%2Fapi-sjmcl%2Fcount)
[![Deepwiki](https://img.shields.io/badge/Ask-DeepWiki-20B2AA?logo=&style=for-the-badge)](https://deepwiki.com/UNIkeEN/SJMCL)

[English](../README.md) · [简体中文](README.zh-Hans.md) · **繁體中文**

## 功能特性

* **跨平臺支援**：相容 Windows 10/11、macOS 與 Linux。
* **高效的例項管理**：支援多個遊戲目錄與例項，集中管理所有例項資源（如存檔、模組、資源包、光影包、截圖等）與設定。
* **便捷的資源下載**：支援從 CurseForge 與 Modrinth 等源下載遊戲客戶端、Mod 載入器、各類遊戲資源與整合包。
* **多賬戶系統支援**：內建 Microsoft 登入與第三方認證伺服器支援，相容 Yggdrasil Connect 的 OAuth 登入流程規範提案。
* **深度連結整合**：可與外部網站與工具集聯動，支援透過系統深度連結、桌面快捷方式一鍵啟動例項等便捷功能。

> 注意：部分功能可能受地區、執行平臺或程式分發型別限制。

### 技術棧

[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=white&labelColor=24C8DB)](https://tauri.app/)
[![Next JS](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Chakra UI](https://img.shields.io/badge/chakra_ui-v2-38B2AC?style=for-the-badge&logo=chakraui&logoColor=white&labelColor=319795)](https://v2.chakra-ui.com/)

## 開始使用

開始使用 SJMCL，只需前往 [官網](https://mc.sjtu.cn/sjmcl/en) 下載最新版即可。

你也可以在 [GitHub Releases](https://github.com/UNIkeEN/SJMCL/releases) 獲取所有版本，包括週期性構建。

SJMCL 目前支援以下平臺：

| 平臺    | 系統版本            | 架構               | 提供的的分發型別                              |
|---------|---------------------|--------------------|--------------------------------------------|
| Windows | 10 及以上           | `aarch64`, `i686`, `x86_64`   | `.msi`，便攜版 `.exe`                |
| macOS   | 10.15 及以上        | `aarch64`, `x86_64`| `.app`，`.dmg`                   |
| Linux   | webkit2gtk 4.1 (如 Ubuntu 22.04) | `x86_64` | `.AppImage`, `.deb`, `.rpm`, 便攜版二進位制檔案 |

瞭解更多功能與常見問題，請參閱 [使用者文件](https://mc.sjtu.cn/sjmcl/zh/docs)。

## 開發與貢獻

首先克隆本專案並安裝前端依賴：

```bash
git clone git@github.com:UNIkeEN/SJMCL.git
npm install
```

使用開發模式執行：

```bash
npm run tauri dev
```

我們熱烈歡迎每一位開發者的貢獻。

* 在開始前，請先閱讀我們的 [貢獻指南](https://github.com/UNIkeEN/SJMCL/blob/main/CONTRIBUTING.md)（內含開發流程詳細說明）。
* API 參考與部分開發者筆記見 [開發者文件](https://mc.sjtu.cn/sjmcl/zh/dev)。
* 歡迎透過 [Pull Request](https://github.com/UNIkeEN/SJMCL/pulls) 或 [GitHub Issues](https://github.com/UNIkeEN/SJMCL/issues) 分享你的想法。

### 倉庫活動

![倉庫活動](https://repobeats.axiom.co/api/embed/ee2f4be0fbc708179a6b40c83cd8ce80702fe6fe.svg "Repobeats analytics image")

## 版權宣告

版權所有 © 2024-2025 SJMCL 團隊。

> 本軟體並非官方 Minecraft 服務。未獲得 Mojang 或 Microsoft 批准或關聯許可。

本專案基於 [GNU 通用公共許可證 v3.0](../LICENSE) 釋出。

依據 GPLv3 第 7 條款，當你分發本軟體的修改版本時，除遵守 GPLv3 外，還須遵守以下 [附加條款](../LICENSE.EXTRA)：

1. 必須更換軟體名稱，禁止使用 SJMCL 或 SJMC Launcher；
2. 禁止移除向統計伺服器傳送資訊的功能（`src-tauri/src/utils/sys_info.rs`），且僅傳送帶字首（不少於兩個字母，如 `XX-0.0.1`）的版本號；
3. 在你的倉庫 README、分發網站或相關文件、軟體的關於頁面中，須明確標註你的程式基於 SJMCL，並註明原倉庫連結。

## 社群合作伙伴

衷心感謝以下組織對 SJMCL 專案開發與社群的支援。

[
  <picture>
    <source srcset="figs/partners/sjmc-dark.png" media="(prefers-color-scheme: dark)">
    <source srcset="figs/partners/sjmc.png" media="(prefers-color-scheme: light)">
    <img src="figs/partners/sjmc.png" alt="SJMC" style="height: 65px;">
  </picture>
](https://mc.sjtu.cn)
&nbsp;&nbsp;
[<img src="figs/partners/sues-mc.png" alt="SUES-MC" style="height: 65px;"/>](https://www.suesmc.ltd/)

[
  <picture>
    <source srcset="figs/partners/mua-dark.png" media="(prefers-color-scheme: dark)">
    <source srcset="figs/partners/mua.png" media="(prefers-color-scheme: light)">
    <img src="figs/partners/mua.png" alt="MUA" style="height: 45px;">
  </picture>
](https://www.mualliance.cn)
&nbsp;&nbsp;&nbsp;&nbsp;
[
  <picture>
    <source srcset="figs/partners/gnwork-dark.png" media="(prefers-color-scheme: dark)">
    <source srcset="figs/partners/gnwork.png" media="(prefers-color-scheme: light)">
    <img src="figs/partners/gnwork.png" alt="GNWORK" style="height: 45px;">
  </picture>
](https://space.bilibili.com/403097853)
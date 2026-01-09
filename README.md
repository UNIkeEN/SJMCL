<img src="docs/figs/banner.png" alt="SJMCL" />

[![Test Build](https://img.shields.io/github/actions/workflow/status/UNIkeEN/SJMCL/test.yml?label=test%20build&logo=github&style=for-the-badge)](https://github.com/UNIkeEN/SJMCL/blob/main/.github/workflows/test.yml)
![Downloads](https://img.shields.io/github/downloads/UNIkeEN/SJMCL/total?style=for-the-badge)
![Stars](https://img.shields.io/github/stars/UNIkeEN/SJMCL?style=for-the-badge)
![Runs](https://img.shields.io/badge/dynamic/json?color=blue&style=for-the-badge&label=runs&query=$.total_count_str&url=https%3A%2F%2Fmc.sjtu.cn%2Fapi-sjmcl%2Fcount)
[![Deepwiki](https://img.shields.io/badge/Ask-DeepWiki-20B2AA?logo=&style=for-the-badge)](https://deepwiki.com/UNIkeEN/SJMCL)

**English** · [简体中文](docs/README.zh-Hans.md) · [繁體中文](docs/README.zh-Hant.md)

## Features

* **Cross Platform**: Supports Windows 10/11, macOS and Linux.
* **Efficient Instance Management**: Supports multiple game directories and instances, allowing the management of all instance resources (such as saves, mods, resource packs, shaders, screenshots, etc.) and settings in one place.
* **Convenient Resource Download**: Supports downloading game clients, mod loaders, various game resources and modpacks from CurseForge and Modrinth.
* **Multi-Account System Support**: Built-in Microsoft login and third-party authentication server support, compatible with the OAuth login process proposed by the Yggdrasil Connect proposal.
* **Deeplink Integration**: Integrates with external websites and tool collections, providing convenient features such as desktop shortcuts for launching instances through system deeplinks.

> Note: some features may be limited by region, platform, or bundle type.

### Built with

[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=white&labelColor=24C8DB)](https://tauri.app/)
[![Next JS](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Chakra UI](https://img.shields.io/badge/chakra_ui-v2-38B2AC?style=for-the-badge&logo=chakraui&logoColor=white&labelColor=319795)](https://v2.chakra-ui.com/)

## Getting Started

Getting started with SJMCL is simple, just download the latest release from the [Official Website](https://mc.sjtu.cn/sjmcl/en).

You can also find all the releases, including the nightly versions, on [GitHub Releases](https://github.com/UNIkeEN/SJMCL/releases).

SJMCL currently supports the following platforms:

| Platform  | Versions            | Architectures              | Provided Bundles                        |
|-----------|---------------------|----------------------------|-----------------------------------------|
| Windows   | 7 and above         | `aarch64`, `i686`, `x86_64`| installer `.exe`, portable `.exe`                 |
| macOS     | 10.15 and above     | `aarch64`, `x86_64`        | `.app`, `.dmg`                          |
| Linux     | webkit2gtk 4.1 (e.g., Ubuntu 22.04) | `aarch64`, `x86_64`   | `.AppImage`, `.deb`, `.rpm`, portable binary |

To learn about how to use SJMCL’s features and browse frequently asked questions, please refer to the [User Documentation](https://mc.sjtu.cn/sjmcl/en/docs).

### Windows 7

If you need to run SJMCL on Windows 7, please first [download the Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download) and install it. We recommend choosing the 'Evergreen Bootstrapper'.

<details>
<summary><h3>Install from Command Line</h3></summary>

<details>
<summary><h4>Arch Linux</h4></summary>

SJMCL is available on the Arch User Repository (AUR). You can install it using a common [AUR helper](https://wiki.archlinux.org/title/AUR_helpers):

```bash
yay -S sjmcl-bin
```

Manual installation without an AUR helper:

```bash
git clone https://aur.archlinux.org/sjmcl-bin.git
cd sjmcl-bin
makepkg -si
```

</details>
</details>

## Development and Contributing

To get started, clone the repository and install the required dependencies:

```bash
git clone git@github.com:UNIkeEN/SJMCL.git
npm install
```

To run the project in development mode:

```bash
npm run tauri dev
```

We warmly invite contributions from everyone. 

* Before you get started, please take a moment to review our [Contributing Guide](https://github.com/UNIkeEN/SJMCL/blob/main/CONTRIBUTING.md) (includes more details on the development workflow). 
* API references and some developers’ insights can be found in the [Developer Documentation](https://mc.sjtu.cn/sjmcl/en/dev).
* Feel free to share your ideas through [Pull Requests](https://github.com/UNIkeEN/SJMCL/pulls) or [GitHub Issues](https://github.com/UNIkeEN/SJMCL/issues).

### Repo Activity

![Repo Activity](https://repobeats.axiom.co/api/embed/ee2f4be0fbc708179a6b40c83cd8ce80702fe6fe.svg "Repobeats analytics image")

## Copyright

Copyright © 2024-2026 SJMCL Team.

> NOT AN OFFICIAL MINECRAFT SERVICE. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.

The software is distributed under [GNU General Public License v3.0](/LICENSE).

By GPLv3 License term 7, we require that when you distribute a modified version of the software, you must obey GPLv3 License as well as the following [additional terms](/LICENSE.EXTRA): 

1. Use a different software name than SJMCL or SJMC Launcher;
2. Mark clearly in your repository README file, your distribution website or thread, Support documents, About Page in the software that your program is based on SJMCL and give out the url of the origin repository.
3. When your modifications to this software are limited solely to **adding** (without modifying or deleting) preset authentication servers (`src-tauri/src/account/helpers/authlib_injector/constants.rs`), the restrictions set forth in Clauses 1 above shall not apply. In this case, you may continue to compile and distribute the software under its original name.

Besides, per term of use of our website, when distributing a modified version of the software, please send version numbers with prefix (more than two letters, e.g. `XX-0.0.1`) to our statistics server (`src-tauri/src/utils/sys_info.rs`) unless your modifications meets Clauses 3 above.

## Contact Us

QQ Group for SJMCL Users: 860851380

You can also send email to [launcher@sjmc.club](mailto:launcher@sjmc.club) if you want to contact us.

## Community Partners

We sincerely thank the following organizations for their development and community support throughout the SJMCL project.

[
  <picture>
    <source srcset="docs/figs/partners/sjmc-dark.png" media="(prefers-color-scheme: dark)">
    <source srcset="docs/figs/partners/sjmc.png" media="(prefers-color-scheme: light)">
    <img src="docs/figs/partners/sjmc.png" alt="SJMC" style="height: 65px;">
  </picture>
](https://mc.sjtu.cn/en/)
&nbsp;&nbsp;
[<img src="docs/figs/partners/sues-mc.png" alt="SUES-MC" style="height: 65px;"/>](https://www.suesmc.ltd/)

[
  <picture>
    <source srcset="docs/figs/partners/mua-dark.png" media="(prefers-color-scheme: dark)">
    <source srcset="docs/figs/partners/mua.png" media="(prefers-color-scheme: light)">
    <img src="docs/figs/partners/mua.png" alt="MUA" style="height: 45px;">
  </picture>
](https://www.mualliance.cn/en)
&nbsp;&nbsp;&nbsp;&nbsp;
[
  <picture>
    <source srcset="docs/figs/partners/gnwork-dark.png" media="(prefers-color-scheme: dark)">
    <source srcset="docs/figs/partners/gnwork.png" media="(prefers-color-scheme: light)">
    <img src="docs/figs/partners/gnwork.png" alt="GNWORK" style="height: 45px;">
  </picture>
](https://space.bilibili.com/403097853)

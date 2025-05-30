# SJMC Launcher

[![Test Build](https://img.shields.io/github/actions/workflow/status/UNIkeEN/SJMCL/test.yml?label=test%20build&logo=github&style=for-the-badge)](https://github.com/UNIkeEN/SJMCL/blob/main/.github/workflows/test.yml)
![Downloads](https://img.shields.io/github/downloads/UNIkeEN/SJMCL/total?style=for-the-badge)
![Stars](https://img.shields.io/github/stars/UNIkeEN/SJMCL?style=for-the-badge)
[![Deepwiki](https://img.shields.io/badge/Ask-DeepWiki-20B2AA?logo=&style=for-the-badge)](https://deepwiki.com/UNIkeEN/SJMCL)

SJMCL is an open-source Minecraft launcher from [Shanghai Jiao Tong University Minecraft Club (SJMC)](https://mc.sjtu.cn/welcome/content/3/).

## Features

* **Cross Platform**: Supports Windows 10/11, macOS and Linux.
* **Efficient Instance Management**: Supports multiple game directories and instances, allowing the management of all instance resources (such as saves, mods, resource packs, shaders, screenshots, etc.) and settings in one place.
* **Convenient Resource Download**: Supports downloading game clients, mod loaders, various game resources and modpacks from CurseForge and Modrinth.
* **Multi-Account System Support**: Built-in Microsoft login and third-party authentication server support, compatible with the OAuth login process proposed by the Yggdrasil Connect proposal.
* **Deeplink Integration**: Integrates with external websites and tool collections, providing convenient features such as desktop shortcuts for launching instances through system deeplinks.

### Built with

[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=white&labelColor=24C8DB)](https://tauri.app/)
[![Next JS](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Chakra UI](https://img.shields.io/badge/chakra_ui-v2-38B2AC?style=for-the-badge&logo=chakraui&logoColor=white&labelColor=319795)](https://v2.chakra-ui.com/)

## Download

Getting started with SJMCL is simple, just download the latest release from the [official website]().

You can also find all the releases in [GitHub Releases](https://github.com/UNIkeEN/SJMCL/releases).

SJMCL currently supports the following platforms:

| Platform  | Versions            | Architectures           | Provided Bundles                        |
|-----------|---------------------|-------------------------|-----------------------------------------|
| Windows   | 10 and above        | `i686`, `x86_64`        | `.msi`, portable `.exe`                 |
| macOS     | 10.15 and above     | `aarch64`, `x86_64`     | `.app`, `.dmg`                          |
| Linux     | webkit2gtk 4.1 (e.g., Ubuntu 22.04) | `x86_64`| `.AppImage`, `.deb`, `.rpm`, portable binary |

Note: some features are only available on specific platforms or specific bundle types.

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
* Feel free to share your ideas through [Pull Requests](https://github.com/UNIkeEN/SJMCL/pulls) or [GitHub Issues](https://github.com/UNIkeEN/SJMCL/issues).

### Repo Activity

TBD

## Copyright

Copyright © 2024-2025 SJMCL Team.

> NOT AN OFFICIAL MINECRAFT SERVICE. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.

The software is distributed under [GNU General Public License v3.0](/LICENSE).

By GPLv3 License term 7, we require that when you distribute a modified version of the software, you must obey GPLv3 License as well as the following [additional terms](/LICENSE.EXTRA): 

1. Use a different software name than SJMCL or SJMC Launcher;
2. Do not remove the function of sending user statisitics to our statisitics server (`src-tauri/src/utils/sys_info.rs`), and send only version numbers with prefix (more than two letters, e.g. `XX-0.0.1`).
3. Mark clearly in your repository README file, your distribution website or thread, Support documents, About Page in the software that you program is based on SJMCL and give out the url of the origin repository.

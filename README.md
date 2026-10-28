# easy-launcher

A fast, no-friction Minecraft launcher for desktop — open, pick a profile, play.

![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=white&labelColor=24C8DB)
![Next.js](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Chakra UI](https://img.shields.io/badge/chakra_ui-v2-38B2AC?style=for-the-badge&logo=chakraui&logoColor=white&labelColor=319795)

## Features

- **Cross-platform**: Windows 10/10, macOS, and Linux
- **Instance management**: multiple game directories and instances; manage saves, mods, resource packs, shaders, and screenshots in one place
- **Image/GIF backgrounds**: user-supplied background images and GIFs
- **Play without an account**: offline login — just a player name, no Microsoft account needed
- **Multi-account**: third-party authentication server support compatible with the Yggdrasil protocol
- **Extensions**: an open extension system to add features without touching the core

## Getting Started

```bash
pnpm install
pnpm tauri dev
```

Production build:

```bash
# default: all bundle targets configured in tauri.conf.json
pnpm tauri build

# Linux only (appimage/deb/rpm depending on config)
pnpm build:linux
```

## Structure

- Frontend: React + Next.js + Chakra UI v2
- Backend: Rust + Tauri v2 (`src-tauri/`)

## License

This project is licensed under the [GNU GPL v3.0](LICENSE).

Based on [SJMCL](https://github.com/UNIkeEN/SJMCL) — this is a fork with a reworked UI/UX and feature set.

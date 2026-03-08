# 安装 SJMCL

从本站下载最新版即可开始使用。你也可以在 [GitHub Releases](https://github.com/UNIkeEN/SJMCL/releases) 获取所有版本，包括周期性构建版本。

## 支持的平台

SJMCL 目前支持以下平台：

| 平台    | 系统版本            | 架构               | 提供的分发类型                              |
|---------|---------------------|--------------------|--------------------------------------------|
| Windows | 7 及以上           | `aarch64`、`i686`、`x86_64` | 安装版 `.exe`、便携版 `.exe`（**推荐便携版**） |
| macOS   | 10.15 及以上        | `aarch64`、`x86_64` | `.app`、`.dmg`（**推荐 `.dmg`**） |
| Linux   | webkit2gtk 4.1（如 Ubuntu 22.04）| `aarch64`、`x86_64` | `.AppImage`、`.deb`、`.rpm`、便携版二进制文件 |

## Windows 7

如果您需要在 Windows 7 上运行 SJMCL，请先 [下载 Microsoft Edge WebView2 运行时](https://developer.microsoft.com/zh-cn/microsoft-edge/webview2#download) 并安装，推荐选择"常青引导程序"。

## 从命令行安装

### Arch Linux

SJMCL 已上传至 Arch Linux 用户仓库（AUR），可使用常见的 [AUR 助手](https://wiki.archlinux.org/title/AUR_helpers) 安装：

```bash
yay -S sjmcl-bin
```

如不使用 AUR 助手，也可以手动安装：

```bash
git clone https://aur.archlinux.org/sjmcl-bin.git
cd sjmcl-bin
makepkg -si
```
